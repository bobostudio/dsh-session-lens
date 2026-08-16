/**
 * Session analytics: fold an expanded SessionEvent stream into the aggregate
 * model behind both the in-app Lens view and the exported HTML report.
 *
 * Aggregation rules:
 * - Token accounting uses ONLY `assistant/message.data.usage` (the final
 *   sample per LLM call); streaming `assistant/chunk` usage is ignored, so no
 *   sample-replacement dedup is needed. `compaction/summary.usage` (the
 *   summarizer call) is tracked separately, never mixed into chat tokens.
 * - Counts are DISJOINT per the TokenUsage contract: billed input =
 *   inputTokens + cacheReadTokens + cacheWriteTokens.
 * - Tool stats pair `tool/call` with `tool/result` by `callId`; duration is
 *   the wall-clock delta between the two events.
 * - Turn rows are keyed by `turn/start` / `turn/end`; events observed before
 *   the first turn (seed/title) are excluded from per-turn rows but still
 *   counted in overview totals where sensible.
 *
 * Everything here is a pure function of the event array — no I/O, no Date
 * dependency (timestamps come from events), fully unit-testable.
 */

import {
  asRecord,
  assistantContent,
  assistantProvenance,
  assistantUsage,
  requestContextInfo,
  requestHeaderInfo,
  textOf,
  toolResultCallId,
  toolResultIsError,
  type SessionEvent,
  type SessionHeader,
  type TokenUsage,
  type ToolCallData,
} from "./events.ts";

export interface TokenTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  /** input + output + cacheRead + cacheWrite (reasoning is inside output). */
  total: number;
}

export interface TurnRow {
  turn: number;
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
  endReason: string | null;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  toolCalls: number;
  toolErrors: number;
  userMessages: number;
  assistantMessages: number;
}

export interface ToolStat {
  name: string;
  calls: number;
  errors: number;
  totalDurationMs: number;
  maxDurationMs: number;
}

export interface ActivityStats {
  compactions: number;
  compactionShadowedTokens: number;
  approvalsAsked: number;
  approvalsApproved: number;
  approvalsDenied: number;
  subagents: number;
  llmRetries: number;
  planModeToggles: number;
  todosWritten: number;
  feedbackRecords: number;
}

export interface ModelUsage {
  provider: string;
  model: string;
  calls: number;
  tokens: TokenTotals;
}

export interface SessionAnalytics {
  sessionId: string | null;
  title: string | null;
  cwd: string | null;
  createdAt: number | null;
  firstEventAt: number | null;
  lastEventAt: number | null;
  durationMs: number | null;
  status: "active" | "completed" | "aborted" | "blocked" | "error" | "interrupted" | "max-tokens";
  turns: number;
  userMessages: number;
  assistantMessages: number;
  reasoningChars: number;
  providers: string[];
  models: string[];
  tokens: TokenTotals;
  compactionTokens: TokenTotals | null;
  perTurn: TurnRow[];
  tools: ToolStat[];
  activity: ActivityStats;
  perModel: ModelUsage[];
  eventCount: number;
}

function zeroTotals(): TokenTotals {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0 };
}

function addUsage(totals: TokenTotals, usage: TokenUsage): void {
  totals.input += usage.inputTokens || 0;
  totals.output += usage.outputTokens || 0;
  totals.cacheRead += usage.cacheReadTokens || 0;
  totals.cacheWrite += usage.cacheWriteTokens || 0;
  totals.reasoning += usage.reasoningTokens || 0;
  totals.total =
    totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
}

interface TurnDraft extends TurnRow {
  usageSeen: boolean;
}

function newTurn(turn: number, startedAt: number): TurnDraft {
  return {
    turn,
    startedAt,
    endedAt: null,
    durationMs: null,
    endReason: null,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    toolCalls: 0,
    toolErrors: 0,
    userMessages: 0,
    assistantMessages: 0,
    usageSeen: false,
  };
}

const END_REASONS = new Set([
  "completed",
  "aborted",
  "blocked",
  "error",
  "interrupted",
  "max-tokens",
]);

/**
 * Fold one session's expanded events into analytics. `header` is the
 * optional first-line session record (id/cwd/createdAt); `fallbackId` is
 * used when neither the header nor a caller-supplied id is available.
 */
export function analyzeSession(
  events: SessionEvent[],
  header?: SessionHeader | null,
  fallbackId?: string | null,
): SessionAnalytics {
  const tokens = zeroTotals();
  let compactionTokens: TokenTotals | null = null;
  const activity: ActivityStats = {
    compactions: 0,
    compactionShadowedTokens: 0,
    approvalsAsked: 0,
    approvalsApproved: 0,
    approvalsDenied: 0,
    subagents: 0,
    llmRetries: 0,
    planModeToggles: 0,
    todosWritten: 0,
    feedbackRecords: 0,
  };

  const turns = new Map<number, TurnDraft>();
  let currentTurn: TurnDraft | null = null;
  const toolByName = new Map<string, ToolStat>();
  const openCalls = new Map<string, { name: string; time: number; turn: number }>();
  const perModel = new Map<string, ModelUsage>();
  const providers = new Set<string>();
  const models = new Set<string>();

  let title: string | null = null;
  let userMessages = 0;
  let assistantMessages = 0;
  let reasoningChars = 0;
  let lastEndReason: string | null = null;
  let firstEventAt: number | null = null;
  let lastEventAt: number | null = null;

  for (const event of events) {
    if (firstEventAt === null) firstEventAt = event.time;
    lastEventAt = event.time;
    const data = asRecord(event.data);

    switch (event.type) {
      case "turn/start": {
        const turnNo = typeof data?.turn === "number" ? data.turn : turns.size + 1;
        const draft = newTurn(turnNo, event.time);
        turns.set(turnNo, draft);
        currentTurn = draft;
        break;
      }
      case "turn/end": {
        const reason = asRecord(data?.reason);
        const kind = typeof reason?.kind === "string" ? reason.kind : null;
        if (kind !== null && END_REASONS.has(kind)) lastEndReason = kind;
        if (currentTurn !== null) {
          currentTurn.endedAt = event.time;
          currentTurn.durationMs = event.time - currentTurn.startedAt;
          currentTurn.endReason = kind;
        }
        break;
      }
      case "session/title": {
        if (typeof data?.title === "string" && data.title.length > 0) title = data.title;
        break;
      }
      case "user/message": {
        userMessages += 1;
        if (currentTurn !== null) currentTurn.userMessages += 1;
        break;
      }
      case "assistant/message": {
        assistantMessages += 1;
        if (currentTurn !== null) currentTurn.assistantMessages += 1;
        const content = assistantContent(event.data);
        if (content !== undefined) {
          for (const block of content) {
            if (block.type === "reasoning" && typeof block.text === "string") {
              reasoningChars += block.text.length;
            }
          }
        }
        const provenance = assistantProvenance(event.data);
        const provider = provenance?.provider;
        const model = provenance?.model;
        if (typeof provider === "string") providers.add(provider);
        if (typeof model === "string") models.add(model);
        const usage = assistantUsage(event.data);
        if (usage !== undefined) {
          addUsage(tokens, usage);
          if (currentTurn !== null) {
            currentTurn.input += usage.inputTokens || 0;
            currentTurn.output += usage.outputTokens || 0;
            currentTurn.cacheRead += usage.cacheReadTokens || 0;
            currentTurn.cacheWrite += usage.cacheWriteTokens || 0;
            currentTurn.reasoning += usage.reasoningTokens || 0;
            currentTurn.usageSeen = true;
          }
          if (typeof provider === "string" || typeof model === "string") {
            const key = `${provider ?? "?"}/${model ?? "?"}`;
            let entry = perModel.get(key);
            if (entry === undefined) {
              entry = {
                provider: provider ?? "unknown",
                model: model ?? "unknown",
                calls: 0,
                tokens: zeroTotals(),
              };
              perModel.set(key, entry);
            }
            entry.calls += 1;
            addUsage(entry.tokens, usage);
          }
        }
        break;
      }
      case "request/context": {
        // Provider/model source for logs whose assistant/message carries no
        // provenance (e.g. rc.6 npm build).
        const info = requestContextInfo(event.data);
        if (info.provider !== undefined) providers.add(info.provider);
        if (info.model !== undefined) models.add(info.model);
        break;
      }
      case "request/header": {
        // Fallback provider/model source (first header only; later headers
        // may reflect mid-session model switches, which request/context
        // already covers).
        if (providers.size === 0 && models.size === 0) {
          const info = requestHeaderInfo(event.data);
          if (info.provider !== undefined) providers.add(info.provider);
          if (info.model !== undefined) models.add(info.model);
        }
        break;
      }
      case "tool/call": {
        const call = (data ?? {}) as unknown as ToolCallData;
        const name = typeof call.name === "string" ? call.name : "unknown";
        let stat = toolByName.get(name);
        if (stat === undefined) {
          stat = { name, calls: 0, errors: 0, totalDurationMs: 0, maxDurationMs: 0 };
          toolByName.set(name, stat);
        }
        stat.calls += 1;
        if (currentTurn !== null) currentTurn.toolCalls += 1;
        if (typeof call.callId === "string") {
          openCalls.set(call.callId, { name, time: event.time, turn: call.turn ?? 0 });
        }
        break;
      }
      case "tool/result": {
        const isError = toolResultIsError(event.data);
        const callId = toolResultCallId(event.data);
        const open = callId !== undefined ? openCalls.get(callId) : undefined;
        // Unmatched results (log rotated before the call, or a replayed
        // result) carry no pairing info — skip rather than fabricate a
        // zero-call "unknown" tool entry.
        if (open === undefined) break;
        const stat = toolByName.get(open.name);
        if (stat !== undefined) {
          if (isError) {
            stat.errors += 1;
            if (currentTurn !== null) currentTurn.toolErrors += 1;
          }
          const duration = Math.max(0, event.time - open.time);
          stat.totalDurationMs += duration;
          stat.maxDurationMs = Math.max(stat.maxDurationMs, duration);
        }
        openCalls.delete(callId!);
        break;
      }
      case "compaction/summary": {
        activity.compactions += 1;
        const shadowed = data?.shadowedTokenCount;
        if (typeof shadowed === "number") activity.compactionShadowedTokens += shadowed;
        const usage = asRecord(data?.usage) as unknown as TokenUsage | null;
        if (usage !== null) {
          compactionTokens ??= zeroTotals();
          addUsage(compactionTokens, usage);
        }
        break;
      }
      case "compaction/prune": {
        const shadowed = data?.shadowedTokenCount;
        if (typeof shadowed === "number") activity.compactionShadowedTokens += shadowed;
        break;
      }
      case "approval/asked": {
        activity.approvalsAsked += 1;
        break;
      }
      case "approval/decided": {
        const outcome = typeof data?.outcome === "string" ? data.outcome : "";
        if (outcome === "approved" || outcome === "allow" || outcome === "yes") {
          activity.approvalsApproved += 1;
        } else if (outcome !== "") {
          activity.approvalsDenied += 1;
        }
        break;
      }
      case "subagent/descriptor": {
        activity.subagents += 1;
        break;
      }
      case "llm/retry":
      case "llm/retry-started": {
        activity.llmRetries += 1;
        break;
      }
      case "plan/mode": {
        activity.planModeToggles += 1;
        break;
      }
      case "todo/write": {
        activity.todosWritten += 1;
        break;
      }
      case "feedback/record": {
        activity.feedbackRecords += 1;
        break;
      }
      default:
        break;
    }
  }

  const perTurn = [...turns.values()].sort((a, b) => a.turn - b.turn);
  const tools = [...toolByName.values()].sort((a, b) => b.calls - a.calls);
  const createdAt = header?.createdAt ?? null;
  const durationMs =
    firstEventAt !== null && lastEventAt !== null ? lastEventAt - firstEventAt : null;
  const lastTurn = perTurn.length > 0 ? perTurn[perTurn.length - 1] : undefined;
  const status: SessionAnalytics["status"] =
    lastTurn !== undefined && lastTurn.endedAt === null
      ? "active"
      : ((lastEndReason as SessionAnalytics["status"] | null) ?? (perTurn.length > 0 ? "completed" : "active"));

  return {
    sessionId: header?.id ?? fallbackId ?? null,
    title,
    cwd: header?.cwd ?? null,
    createdAt,
    firstEventAt,
    lastEventAt,
    durationMs,
    status,
    turns: perTurn.length,
    userMessages,
    assistantMessages,
    reasoningChars,
    providers: [...providers],
    models: [...models],
    tokens,
    compactionTokens,
    perTurn,
    tools,
    activity,
    perModel: [...perModel.values()].sort((a, b) => b.tokens.total - a.tokens.total),
    eventCount: events.length,
  };
}

/** Format a compact human token count (12.3k / 1.2M). */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return String(n);
}

/** Format a duration as `m:ss` / `h:mm:ss`, em-dash when null. */
export function formatDuration(ms: number | null): string {
  if (ms === null || ms < 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

/** Plain-text preview of a user/assistant message (for replay rendering). */
export { textOf };
