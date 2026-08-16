// src/events.ts
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function assistantContent(data) {
  const rec = asRecord(data);
  if (rec === null) return void 0;
  if (Array.isArray(rec.content)) return rec.content;
  const message = asRecord(rec.message);
  if (message !== null && Array.isArray(message.content)) return message.content;
  return void 0;
}
function assistantUsage(data) {
  const rec = asRecord(data);
  const usage = asRecord(rec?.usage);
  return usage === null ? void 0 : usage;
}
function assistantProvenance(data) {
  const rec = asRecord(data);
  const flat = asRecord(rec?.provenance);
  if (flat !== null) return flat;
  const message = asRecord(rec?.message);
  const nested = asRecord(message?.provenance);
  return nested === null ? void 0 : nested;
}
function toolResultCallId(data) {
  const rec = asRecord(data);
  if (rec === null) return void 0;
  if (typeof rec.callId === "string") return rec.callId;
  const message = asRecord(rec.message);
  const source = asRecord(message?.source);
  if (typeof source?.callId === "string") return source.callId;
  if (Array.isArray(message?.content)) {
    for (const block of message.content) {
      const b = asRecord(block);
      if (typeof b?.toolCallId === "string") return b.toolCallId;
    }
  }
  return void 0;
}
function toolResultIsError(data) {
  const rec = asRecord(data);
  if (rec === null) return false;
  if (rec.isError === true) return true;
  const message = asRecord(rec.message);
  if (message?.isError === true) return true;
  return asRecord(rec.error) !== null;
}
function requestContextInfo(data) {
  const rec = asRecord(data);
  if (rec === null) return {};
  return {
    ...typeof rec.provider === "string" ? { provider: rec.provider } : {},
    ...typeof rec.model === "string" ? { model: rec.model } : {}
  };
}
function requestHeaderInfo(data) {
  const rec = asRecord(data);
  const header = asRecord(rec?.header);
  const config = asRecord(header?.config);
  if (config === null) return {};
  return {
    ...typeof config.provider === "string" ? { provider: config.provider } : {},
    ...typeof config.model === "string" ? { model: config.model } : {}
  };
}
function textOf(blocks) {
  if (!Array.isArray(blocks)) return "";
  let out = "";
  for (const block of blocks) {
    if (block && block.type === "text" && typeof block.text === "string") {
      out += block.text;
    }
  }
  return out;
}

// src/analytics.ts
function zeroTotals() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0 };
}
function addUsage(totals, usage) {
  totals.input += usage.inputTokens || 0;
  totals.output += usage.outputTokens || 0;
  totals.cacheRead += usage.cacheReadTokens || 0;
  totals.cacheWrite += usage.cacheWriteTokens || 0;
  totals.reasoning += usage.reasoningTokens || 0;
  totals.total = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
}
function newTurn(turn, startedAt) {
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
    usageSeen: false
  };
}
var END_REASONS = /* @__PURE__ */ new Set([
  "completed",
  "aborted",
  "blocked",
  "error",
  "interrupted",
  "max-tokens"
]);
function analyzeSession(events, header, fallbackId) {
  const tokens = zeroTotals();
  let compactionTokens = null;
  const activity = {
    compactions: 0,
    compactionShadowedTokens: 0,
    approvalsAsked: 0,
    approvalsApproved: 0,
    approvalsDenied: 0,
    subagents: 0,
    llmRetries: 0,
    planModeToggles: 0,
    todosWritten: 0,
    feedbackRecords: 0
  };
  const turns = /* @__PURE__ */ new Map();
  let currentTurn = null;
  const toolByName = /* @__PURE__ */ new Map();
  const openCalls = /* @__PURE__ */ new Map();
  const perModel = /* @__PURE__ */ new Map();
  const providers = /* @__PURE__ */ new Set();
  const models = /* @__PURE__ */ new Set();
  let title = null;
  let userMessages = 0;
  let assistantMessages = 0;
  let reasoningChars = 0;
  let lastEndReason = null;
  let firstEventAt = null;
  let lastEventAt = null;
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
        if (content !== void 0) {
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
        if (usage !== void 0) {
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
            if (entry === void 0) {
              entry = {
                provider: provider ?? "unknown",
                model: model ?? "unknown",
                calls: 0,
                tokens: zeroTotals()
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
        const info = requestContextInfo(event.data);
        if (info.provider !== void 0) providers.add(info.provider);
        if (info.model !== void 0) models.add(info.model);
        break;
      }
      case "request/header": {
        if (providers.size === 0 && models.size === 0) {
          const info = requestHeaderInfo(event.data);
          if (info.provider !== void 0) providers.add(info.provider);
          if (info.model !== void 0) models.add(info.model);
        }
        break;
      }
      case "tool/call": {
        const call = data ?? {};
        const name = typeof call.name === "string" ? call.name : "unknown";
        let stat = toolByName.get(name);
        if (stat === void 0) {
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
        const open = callId !== void 0 ? openCalls.get(callId) : void 0;
        if (open === void 0) break;
        const stat = toolByName.get(open.name);
        if (stat !== void 0) {
          if (isError) {
            stat.errors += 1;
            if (currentTurn !== null) currentTurn.toolErrors += 1;
          }
          const duration = Math.max(0, event.time - open.time);
          stat.totalDurationMs += duration;
          stat.maxDurationMs = Math.max(stat.maxDurationMs, duration);
        }
        openCalls.delete(callId);
        break;
      }
      case "compaction/summary": {
        activity.compactions += 1;
        const shadowed = data?.shadowedTokenCount;
        if (typeof shadowed === "number") activity.compactionShadowedTokens += shadowed;
        const usage = asRecord(data?.usage);
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
  const durationMs = firstEventAt !== null && lastEventAt !== null ? lastEventAt - firstEventAt : null;
  const lastTurn = perTurn.length > 0 ? perTurn[perTurn.length - 1] : void 0;
  const status = lastTurn !== void 0 && lastTurn.endedAt === null ? "active" : lastEndReason ?? (perTurn.length > 0 ? "completed" : "active");
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
    eventCount: events.length
  };
}
function formatTokens(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}k`;
  return String(n);
}
function formatDuration(ms) {
  if (ms === null || ms < 0) return "\u2014";
  const totalSeconds = Math.round(ms / 1e3);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  const pad = (v) => String(v).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}
export {
  analyzeSession,
  formatDuration,
  formatTokens,
  textOf
};
