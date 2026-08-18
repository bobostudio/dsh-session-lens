// src/index.ts
import { homedir } from "node:os";

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
function toolResultContent(data) {
  const rec = asRecord(data);
  if (rec === null) return void 0;
  if (Array.isArray(rec.content)) return rec.content;
  const message = asRecord(rec.message);
  if (message !== null && Array.isArray(message.content)) {
    const out = [];
    for (const block of message.content) {
      const b = asRecord(block);
      if (b !== null && b.type === "tool-result" && Array.isArray(b.content)) {
        out.push(...b.content);
      } else {
        out.push(block);
      }
    }
    return out;
  }
  return void 0;
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
        const name2 = typeof call.name === "string" ? call.name : "unknown";
        let stat = toolByName.get(name2);
        if (stat === void 0) {
          stat = { name: name2, calls: 0, errors: 0, totalDurationMs: 0, maxDurationMs: 0 };
          toolByName.set(name2, stat);
        }
        stat.calls += 1;
        if (currentTurn !== null) currentTurn.toolCalls += 1;
        if (typeof call.callId === "string") {
          openCalls.set(call.callId, { name: name2, time: event.time, turn: call.turn ?? 0 });
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

// src/redact.ts
var REDACT_DEFAULTS = {
  maskPaths: true,
  maxTextLength: 2e3
};
var STORY_EVENT_TYPES = /* @__PURE__ */ new Set([
  "turn/start",
  "turn/end",
  "user/message",
  "assistant/message",
  "tool/call",
  "tool/result",
  "session/title",
  "compaction/start",
  "compaction/summary",
  "compaction/end",
  "approval/asked",
  "approval/decided",
  "subagent/descriptor",
  "todo/write",
  "plan/mode",
  "feedback/record"
]);
function filterStoryEvents(events) {
  return events.filter((event) => STORY_EVENT_TYPES.has(event.type));
}
function collectPathVariants(cwd) {
  if (typeof cwd !== "string" || cwd.length < 3) return [];
  const variants = /* @__PURE__ */ new Set();
  variants.add(cwd);
  if (cwd.includes("\\")) variants.add(cwd.replace(/\\/g, "/"));
  if (cwd.includes("/")) variants.add(cwd.replace(/\//g, "\\"));
  for (const v of [...variants]) {
    if (/^[a-z]:/i.test(v)) variants.add(v[0].toUpperCase() + v.slice(1));
    if (/^[A-Z]:/.test(v)) variants.add(v[0].toLowerCase() + v.slice(1));
  }
  for (const v of [...variants]) {
    if (v.includes("\\")) variants.add(v.replace(/\\/g, "\\\\"));
  }
  return [...variants].sort((a, b) => b.length - a.length);
}
function collectAllVariants(paths) {
  const all = /* @__PURE__ */ new Set();
  for (const p of paths) {
    for (const v of collectPathVariants(p)) all.add(v);
  }
  return [...all].sort((a, b) => b.length - a.length);
}
function maskText(text, variants) {
  let out = text;
  for (const variant of variants) {
    if (variant.length > 0 && out.includes(variant)) {
      out = out.split(variant).join("~");
    }
  }
  return out;
}
function truncate(text, max) {
  if (max === null || text.length <= max) return text;
  const omitted = text.length - max;
  return `${text.slice(0, max)}
\u2026[+${omitted} chars]`;
}
function redactValue(value, variants, max, inToolPayload) {
  if (typeof value === "string") {
    let out = value;
    if (variants.length > 0) out = maskText(out, variants);
    if (inToolPayload) out = truncate(out, max);
    return out;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, variants, max, inToolPayload));
  }
  const rec = asRecord(value);
  if (rec !== null) {
    const out = {};
    for (const [key, item] of Object.entries(rec)) {
      out[key] = redactValue(item, variants, max, inToolPayload);
    }
    return out;
  }
  return value;
}
function redactBlocks(blocks, variants, max, truncateText) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((block) => {
    if (block.type === "image") {
      return { type: "text", text: "[image \xB7 \u56FE\u7247\u672A\u5BFC\u51FA]" };
    }
    const rec = asRecord(block);
    if (rec === null) return block;
    const out = { ...rec };
    if (typeof out.text === "string") {
      let text = out.text;
      if (variants.length > 0) text = maskText(text, variants);
      if (truncateText) text = truncate(text, max);
      out.text = text;
    }
    if (typeof out.arguments === "string") {
      let args = out.arguments;
      if (variants.length > 0) args = maskText(args, variants);
      out.arguments = truncate(args, max);
    }
    return out;
  });
}
function redactEvent(event, options = {}) {
  const maskPaths = options.maskPaths ?? REDACT_DEFAULTS.maskPaths;
  const max = options.maxTextLength === void 0 ? REDACT_DEFAULTS.maxTextLength : options.maxTextLength;
  const variants = maskPaths ? collectAllVariants([options.cwd, ...options.extraPaths ?? []]) : [];
  const data = asRecord(event.data);
  if (data === null) return event;
  if (event.type === "tool/call" || event.type === "tool/result") {
    return { ...event, data: redactValue(data, variants, max, true) };
  }
  if (event.type === "user/message" || event.type === "assistant/message") {
    const flat = Array.isArray(data.content) ? data.content : void 0;
    const message = asRecord(data.message);
    const nested = message !== null && Array.isArray(message.content) ? message.content : void 0;
    return {
      ...event,
      data: {
        ...data,
        ...flat !== void 0 ? { content: redactBlocks(flat, variants, max, false) } : {},
        ...message !== null ? { message: { ...message, content: redactBlocks(nested, variants, max, false) } } : {}
      }
    };
  }
  if (variants.length > 0) {
    return { ...event, data: redactValue(data, variants, null, false) };
  }
  return event;
}
function redactEvents(events, options = {}) {
  return events.map((event) => redactEvent(event, options));
}

// src/export-html.ts
var STRINGS = {
  zh: {
    report: "\u4F1A\u8BDD\u6D1E\u5BDF\u62A5\u544A",
    generatedBy: "\u7531 dsh-session-lens \u751F\u6210",
    privacyNote: "\u9690\u79C1\u8BF4\u660E\uFF1A\u672C\u6587\u4EF6\u4E0D\u542B\u7CFB\u7EDF\u63D0\u793A\u8BCD\u4E0E\u5185\u90E8\u8BF7\u6C42\u4E8B\u4EF6\uFF1B\u672C\u5730\u8DEF\u5F84\u5DF2\u8131\u654F\u4E3A ~\uFF1B\u56FE\u7247\u4E0D\u5BFC\u51FA\u3002",
    privacyNoteFull: "\u9690\u79C1\u8BF4\u660E\uFF1A\u672C\u6587\u4EF6\u4E0D\u542B\u7CFB\u7EDF\u63D0\u793A\u8BCD\u4E0E\u5185\u90E8\u8BF7\u6C42\u4E8B\u4EF6\uFF1B\u56FE\u7247\u4E0D\u5BFC\u51FA\u3002",
    tokens: "Token \u7528\u91CF",
    input: "\u8F93\u5165",
    output: "\u8F93\u51FA",
    cacheRead: "\u7F13\u5B58\u8BFB",
    cacheWrite: "\u7F13\u5B58\u5199",
    reasoning: "\u601D\u7EF4\u94FE",
    compaction: "\u538B\u7F29\u6458\u8981\u8C03\u7528",
    total: "\u5408\u8BA1",
    perTurn: "\u6309 Turn \u5206\u89E3",
    turn: "Turn",
    duration: "\u65F6\u957F",
    toolCalls: "\u5DE5\u5177\u8C03\u7528",
    errors: "\u9519\u8BEF",
    messages: "\u6D88\u606F",
    tools: "\u5DE5\u5177\u7EDF\u8BA1",
    tool: "\u5DE5\u5177",
    calls: "\u8C03\u7528",
    activity: "\u6D3B\u52A8\u7EDF\u8BA1",
    compactions: "\u4E0A\u4E0B\u6587\u538B\u7F29",
    shadowed: "\u538B\u7F29\u906E\u853D token",
    approvals: "\u5BA1\u6279",
    subagents: "\u5B50 Agent",
    retries: "LLM \u91CD\u8BD5",
    replay: "\u4F1A\u8BDD\u56DE\u653E",
    reasoningToggle: "\u601D\u7EF4\u94FE",
    toolArgs: "\u53C2\u6570",
    toolResult: "\u7ED3\u679C",
    errorBadge: "\u9519\u8BEF",
    turnDivider: "Turn",
    approvalAsked: "\u8BF7\u6C42\u5BA1\u6279",
    approvalApproved: "\u5DF2\u6279\u51C6",
    approvalDenied: "\u5DF2\u62D2\u7EDD",
    compactionMarker: "\u4E0A\u4E0B\u6587\u538B\u7F29",
    subagentMarker: "\u5B50 Agent",
    planMode: "\u8BA1\u5212\u6A21\u5F0F",
    todoUpdated: "Todo \u66F4\u65B0",
    feedback: "\u53CD\u9988",
    user: "\u7528\u6237",
    assistant: "\u52A9\u624B",
    model: "\u6A21\u578B",
    status: "\u72B6\u6001",
    statusActive: "\u8FDB\u884C\u4E2D",
    createdAt: "\u521B\u5EFA\u65F6\u95F4",
    eventCount: "\u4E8B\u4EF6\u6570",
    truncatedNote: "\u5DE5\u5177\u53C2\u6570/\u7ED3\u679C\u5DF2\u622A\u65AD",
    fullNote: "\u5DE5\u5177\u53C2\u6570/\u7ED3\u679C\u5B8C\u6574\u4FDD\u7559"
  },
  en: {
    report: "Session Insights Report",
    generatedBy: "Generated by dsh-session-lens",
    privacyNote: "Privacy: this file contains no system prompt or internal request events; local paths are masked as ~; images are not exported.",
    privacyNoteFull: "Privacy: this file contains no system prompt or internal request events; images are not exported.",
    tokens: "Token usage",
    input: "Input",
    output: "Output",
    cacheRead: "Cache read",
    cacheWrite: "Cache write",
    reasoning: "Reasoning",
    compaction: "Compaction call",
    total: "Total",
    perTurn: "Per-turn breakdown",
    turn: "Turn",
    duration: "Duration",
    toolCalls: "Tool calls",
    errors: "Errors",
    messages: "Messages",
    tools: "Tool stats",
    tool: "Tool",
    calls: "Calls",
    activity: "Activity",
    compactions: "Compactions",
    shadowed: "Shadowed tokens",
    approvals: "Approvals",
    subagents: "Subagents",
    retries: "LLM retries",
    replay: "Replay",
    reasoningToggle: "Reasoning",
    toolArgs: "Arguments",
    toolResult: "Result",
    errorBadge: "error",
    turnDivider: "Turn",
    approvalAsked: "Approval requested",
    approvalApproved: "Approved",
    approvalDenied: "Denied",
    compactionMarker: "Context compaction",
    subagentMarker: "Subagent",
    planMode: "Plan mode",
    todoUpdated: "Todo update",
    feedback: "Feedback",
    user: "User",
    assistant: "Assistant",
    model: "Model",
    status: "Status",
    statusActive: "active",
    createdAt: "Created",
    eventCount: "Events",
    truncatedNote: "tool arguments/results truncated",
    fullNote: "tool arguments/results kept in full"
  }
};
function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function fmtTime(ms, lang) {
  if (ms === null) return "\u2014";
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(ms));
}
var TOKEN_SEGMENTS = [
  { key: "input", color: "#4c8dff" },
  { key: "output", color: "#34c98e" },
  { key: "cacheRead", color: "#8b7cf6" },
  { key: "cacheWrite", color: "#c9a0f6" },
  { key: "reasoning", color: "#f6a35c" }
];
function tokenBarSvg(a, s) {
  const segments = TOKEN_SEGMENTS.map((seg) => ({
    label: s[seg.key],
    color: seg.color,
    value: a.tokens[seg.key]
  })).filter((seg) => seg.value > 0);
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  if (total === 0) return "";
  const width = 720;
  const height = 22;
  let x = 0;
  const rects = [];
  for (const seg of segments) {
    const w = Math.max(2, Math.round(seg.value / total * width));
    rects.push(`<rect x="${x}" y="0" width="${Math.min(w, width - x)}" height="${height}" fill="${seg.color}"><title>${esc(seg.label)} ${formatTokens(seg.value)}</title></rect>`);
    x += w;
    if (x >= width) break;
  }
  const legend = segments.map(
    (seg) => `<span class="legend-item"><span class="legend-dot" style="background:${seg.color}"></span>${esc(seg.label)} ${formatTokens(seg.value)}</span>`
  ).join("");
  return `<svg viewBox="0 0 ${width} ${height}" class="token-bar" role="img" aria-label="${esc(s.tokens)}">${rects.join("")}</svg><div class="legend">${legend}</div>`;
}
function statChip(label, value) {
  return `<div class="chip"><div class="chip-value">${esc(value)}</div><div class="chip-label">${esc(label)}</div></div>`;
}
function renderStats(a, s, lang) {
  const turnRows = a.perTurn.map(
    (t) => `<tr>
<td>#${t.turn}</td>
<td>${esc(formatDuration(t.durationMs))}</td>
<td>${formatTokens(t.input + t.cacheRead + t.cacheWrite)}</td>
<td>${formatTokens(t.output)}</td>
<td>${t.reasoning > 0 ? formatTokens(t.reasoning) : "\u2014"}</td>
<td>${t.toolCalls}${t.toolErrors > 0 ? ` <span class="err">(${t.toolErrors} ${esc(s.errors)})</span>` : ""}</td>
</tr>`
  ).join("");
  const toolRows = a.tools.map((tool) => {
    const rate = tool.calls > 0 ? Math.round((tool.calls - tool.errors) / tool.calls * 100) : 100;
    return `<tr>
<td><code>${esc(tool.name)}</code></td>
<td>${tool.calls}</td>
<td>${tool.errors > 0 ? `<span class="err">${tool.errors}</span>` : "0"}</td>
<td>${rate}%</td>
<td>${esc(formatDuration(tool.totalDurationMs))}</td>
</tr>`;
  }).join("");
  const act = a.activity;
  const activityItems = [
    [s.compactions, String(act.compactions)],
    [s.shadowed, act.compactionShadowedTokens > 0 ? formatTokens(act.compactionShadowedTokens) : "\u2014"],
    [s.approvals, `${act.approvalsApproved}/${act.approvalsAsked}`],
    [s.subagents, String(act.subagents)],
    [s.retries, String(act.llmRetries)]
  ];
  return `<section class="stats">
<h2>${esc(s.tokens)}</h2>
<div class="chips">
${statChip(s.total, formatTokens(a.tokens.total))}
${statChip(s.input, formatTokens(a.tokens.input))}
${statChip(s.output, formatTokens(a.tokens.output))}
${statChip(s.cacheRead, formatTokens(a.tokens.cacheRead))}
${statChip(s.cacheWrite, formatTokens(a.tokens.cacheWrite))}
${statChip(s.reasoning, formatTokens(a.tokens.reasoning))}
${a.compactionTokens !== null ? statChip(s.compaction, formatTokens(a.compactionTokens.total)) : ""}
</div>
${tokenBarSvg(a, s)}
${a.perTurn.length > 0 ? `<h2>${esc(s.perTurn)}</h2>
<table><thead><tr><th>${esc(s.turn)}</th><th>${esc(s.duration)}</th><th>${esc(s.input)}+${esc(s.cacheRead)}</th><th>${esc(s.output)}</th><th>${esc(s.reasoning)}</th><th>${esc(s.toolCalls)}</th></tr></thead>
<tbody>${turnRows}</tbody></table>` : ""}
${a.tools.length > 0 ? `<h2>${esc(s.tools)}</h2>
<table><thead><tr><th>${esc(s.tool)}</th><th>${esc(s.calls)}</th><th>${esc(s.errors)}</th><th>OK%</th><th>${esc(s.duration)}</th></tr></thead>
<tbody>${toolRows}</tbody></table>` : ""}
<h2>${esc(s.activity)}</h2>
<div class="activity">${activityItems.map(([k, v]) => `<span class="activity-item"><b>${esc(v)}</b> ${esc(k)}</span>`).join("")}</div>
</section>`;
}
function detailsBlock(summary, body, extraClass = "") {
  return `<details class="fold ${extraClass}"><summary>${esc(summary)}</summary><pre>${esc(body)}</pre></details>`;
}
function formatArgs(raw) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
function renderBlocks(blocks, s, isAssistant) {
  if (!Array.isArray(blocks)) return "";
  const parts = [];
  for (const block of blocks) {
    if (block.type === "reasoning" && typeof block.text === "string" && block.text.length > 0) {
      parts.push(detailsBlock(`${s.reasoningToggle} (${block.text.length} chars)`, block.text, "reasoning"));
    } else if (block.type === "text" && typeof block.text === "string" && block.text.length > 0) {
      parts.push(`<div class="msg-text">${esc(block.text)}</div>`);
    } else if (block.type === "tool-call") {
      const call = block;
      parts.push(
        `<div class="tool-call"><span class="tool-badge">\u2699 ${esc(call.name ?? "tool")}</span>${detailsBlock(
          s.toolArgs,
          formatArgs(typeof call.arguments === "string" ? call.arguments : "")
        )}</div>`
      );
    }
  }
  return parts.join("");
}
function renderReplay(events, s) {
  const out = [];
  for (const event of events) {
    const data = asRecord(event.data);
    switch (event.type) {
      case "turn/start": {
        const turn = typeof data?.turn === "number" ? data.turn : "?";
        out.push(`<div class="turn-divider"><span>${esc(s.turnDivider)} ${turn}</span></div>`);
        break;
      }
      case "user/message": {
        const body = renderBlocks(data?.content, s, false);
        out.push(`<div class="msg user"><div class="msg-role">${esc(s.user)}</div>${body}</div>`);
        break;
      }
      case "assistant/message": {
        const provenance = assistantProvenance(event.data);
        const model = provenance?.model ? ` \xB7 ${esc(provenance.model)}` : "";
        out.push(`<div class="msg assistant"><div class="msg-role">${esc(s.assistant)}${model}</div>${renderBlocks(assistantContent(event.data), s, true)}</div>`);
        break;
      }
      case "tool/call": {
        const name2 = typeof data?.name === "string" ? data.name : "tool";
        const args = typeof data?.arguments === "string" ? data.arguments : "";
        out.push(`<div class="msg tool"><div class="msg-role">\u2699 ${esc(name2)}</div>${detailsBlock(s.toolArgs, formatArgs(args))}</div>`);
        break;
      }
      case "tool/result": {
        const isErr = toolResultIsError(event.data);
        const text = textOf(toolResultContent(event.data));
        out.push(
          `<div class="msg result${isErr ? " failed" : ""}"><div class="msg-role">${esc(s.toolResult)}${isErr ? ` <span class="err">(${esc(s.errorBadge)})</span>` : ""}</div>${detailsBlock(s.toolResult, text)}</div>`
        );
        break;
      }
      case "approval/asked": {
        const tool = typeof data?.toolName === "string" ? data.toolName : "";
        out.push(`<div class="marker">\u{1F6E1} ${esc(s.approvalAsked)}: <code>${esc(tool)}</code></div>`);
        break;
      }
      case "approval/decided": {
        const outcome = typeof data?.outcome === "string" ? data.outcome : "";
        const approved = outcome === "approved" || outcome === "allow" || outcome === "yes";
        out.push(`<div class="marker">${approved ? "\u2705" : "\u26D4"} ${approved ? esc(s.approvalApproved) : esc(s.approvalDenied)}</div>`);
        break;
      }
      case "compaction/summary": {
        const shadowed = typeof data?.shadowedTokenCount === "number" ? ` \xB7 ${formatTokens(data.shadowedTokenCount)} tokens` : "";
        out.push(`<div class="marker">\u{1F5DC} ${esc(s.compactionMarker)}${shadowed}</div>`);
        break;
      }
      case "subagent/descriptor": {
        const role = typeof data?.role === "string" ? data.role : typeof data?.id === "string" ? data.id : "";
        out.push(`<div class="marker">\u{1F433} ${esc(s.subagentMarker)}: ${esc(role)}</div>`);
        break;
      }
      case "plan/mode": {
        out.push(`<div class="marker">\u{1F4CB} ${esc(s.planMode)}</div>`);
        break;
      }
      case "todo/write": {
        out.push(`<div class="marker">\u2611 ${esc(s.todoUpdated)}</div>`);
        break;
      }
      case "feedback/record": {
        out.push(`<div class="marker">\u{1F4AC} ${esc(s.feedback)}</div>`);
        break;
      }
      default:
        break;
    }
  }
  return out.join("\n");
}
var LIGHT_CSS = `
*{box-sizing:border-box}
body{margin:0;padding:32px 16px;font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:#f6f7f9;color:#1c1f24;line-height:1.65}
main{max-width:860px;margin:0 auto}
header.report{margin-bottom:24px}
h1{font-size:22px;margin:0 0 8px}
h2{font-size:15px;margin:22px 0 8px;color:#5a6472}
.meta{color:#5a6472;font-size:13px;display:flex;flex-wrap:wrap;gap:6px 14px}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}
.chip{background:#fff;border:1px solid #e3e7ec;border-radius:10px;padding:8px 14px;min-width:96px}
.chip-value{font-size:17px;font-weight:650;font-variant-numeric:tabular-nums}
.chip-label{font-size:11px;color:#5a6472}
.token-bar{width:100%;border-radius:6px;overflow:hidden;display:block;background:#e9edf1}
.legend{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px;font-size:12px;color:#5a6472}
.legend-dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e3e7ec;border-radius:10px;overflow:hidden;font-size:13px}
th,td{text-align:left;padding:7px 12px;border-bottom:1px solid #eef1f4;font-variant-numeric:tabular-nums}
th{background:#f0f2f5;font-weight:600;color:#455060;font-size:12px}
tr:last-child td{border-bottom:none}
code{background:#eef1f4;border-radius:5px;padding:1px 6px;font-size:12px}
.err{color:#d6453d}
.activity{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13px;color:#455060}
.msg{margin:10px 0;padding:12px 16px;border-radius:12px;background:#fff;border:1px solid #e3e7ec}
.msg.user{background:#eef4ff;border-color:#d5e3fb}
.msg.tool,.msg.result{background:#fafbfc}
.msg.failed{border-color:#f0c8c5}
.msg-role{font-size:12px;font-weight:650;color:#5a6472;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
.msg-text{white-space:pre-wrap;word-break:break-word;font-size:14px}
.fold{margin:6px 0}
.fold summary{cursor:pointer;font-size:12px;color:#4c8dff;user-select:none}
.fold pre{margin:8px 0 2px;padding:10px 12px;background:#f0f2f5;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:420px;overflow:auto}
.fold.reasoning pre{color:#5a6472;font-style:italic}
.tool-badge{display:inline-block;background:#e8eeff;color:#3a63c8;border-radius:6px;padding:2px 8px;font-size:12px;margin-bottom:4px}
.turn-divider{display:flex;align-items:center;gap:12px;margin:22px 0 6px;color:#8a94a1;font-size:12px;font-weight:650;letter-spacing:.08em;text-transform:uppercase}
.turn-divider::before,.turn-divider::after{content:"";flex:1;border-top:1px solid #dfe4ea}
.marker{margin:6px 0;padding:6px 12px;font-size:12px;color:#5a6472;background:#f0f2f5;border-radius:8px;display:inline-block}
footer{margin-top:28px;padding-top:14px;border-top:1px solid #e3e7ec;font-size:12px;color:#8a94a1}
footer a{color:#4c8dff;text-decoration:none}
.privacy{margin-top:6px}
`;
var DARK_CSS = `
body{background:#14161a;color:#dde2e8}
.chip,table,.msg{background:#1c1f24;border-color:#2c313a}
th{background:#22262d;color:#a7b0bc}
td{border-color:#262b33}
code{background:#262b33}
.msg.user{background:#17233a;border-color:#24365c}
.msg.tool,.msg.result{background:#191c21}
.msg.failed{border-color:#5c2f2c}
.fold pre{background:#22262d}
.marker{background:#22262d;color:#a7b0bc}
.turn-divider::before,.turn-divider::after{border-color:#2c313a}
footer{border-color:#2c313a}
.token-bar{background:#262b33}
h2,.meta,.chip-label,.msg-role,.activity{color:#8a94a1}
`;
function buildCss(theme) {
  const root = theme === "dark" ? ":root{color-scheme:dark}" : theme === "light" ? ":root{color-scheme:light}" : ":root{color-scheme:light dark}";
  if (theme === "light") return `${root}
${LIGHT_CSS}`;
  if (theme === "dark") return `${root}
${LIGHT_CSS}
${DARK_CSS}`;
  return `${root}
${LIGHT_CSS}
@media (prefers-color-scheme:dark){
${DARK_CSS}
}`;
}
function renderSessionHtml(events, analyticsInput, header, options = {}) {
  const lang = options.lang === "en" ? "en" : "zh";
  const theme = options.theme ?? "dark";
  const s = STRINGS[lang];
  const analytics = analyticsInput ?? analyzeSession(events, header);
  const story = redactEvents(filterStoryEvents(events), options);
  const title = analytics.title ?? analytics.sessionId ?? "session";
  const modelLabel = analytics.models.join(", ") || "\u2014";
  const truncated = (options.maxTextLength === void 0 ? 2e3 : options.maxTextLength) !== null;
  const masked = options.maskPaths !== false;
  const statusLabel = analytics.status === "active" ? s.statusActive : analytics.status;
  return `<!doctype html>
<html lang="${lang === "zh" ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
<title>${esc(title)} \xB7 ${esc(s.report)}</title>
<style>${buildCss(theme)}</style>
</head>
<body>
<main>
<header class="report">
<h1>${esc(title)}</h1>
<div class="meta">
<span>${esc(s.model)}: ${esc(modelLabel)}</span>
<span>${esc(s.status)}: ${esc(statusLabel)}</span>
<span>${esc(s.createdAt)}: ${esc(fmtTime(analytics.createdAt ?? analytics.firstEventAt, lang))}</span>
<span>${esc(s.duration)}: ${esc(formatDuration(analytics.durationMs))}</span>
<span>${esc(s.turn)}: ${analytics.turns}</span>
<span>${esc(s.messages)}: ${analytics.userMessages + analytics.assistantMessages}</span>
<span>${esc(s.eventCount)}: ${analytics.eventCount}</span>
</div>
</header>
${renderStats(analytics, s, lang)}
<h2>${esc(s.replay)}</h2>
<section class="replay">
${renderReplay(story, s)}
</section>
<footer>
<div>${esc(s.generatedBy)} \xB7 <a href="https://github.com/bobostudio/dsh-session-lens">github.com/bobostudio/dsh-session-lens</a> \xB7 ${esc(truncated ? s.truncatedNote : s.fullNote)}</div>
<div class="privacy">${esc(masked ? s.privacyNote : s.privacyNoteFull)}</div>
</footer>
</main>
</body>
</html>
`;
}

// src/index.ts
var name = "session-lens";
var inject = ["webServer"];
var ANALYTICS_PATH = "/api/session-lens/analytics";
var EXPORT_PATH = "/api/session-lens/export";
var SESSION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-cache"
  });
  res.end(body);
}
function isLoopbackAddress(address) {
  if (typeof address !== "string") return false;
  const a = address.toLowerCase();
  if (a === "::1") return true;
  const ipv4 = a.startsWith("::ffff:") ? a.slice(7) : a;
  const octets = ipv4.split(".");
  return octets.length === 4 && octets[0] === "127" && octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function hostNameOf(value) {
  if (typeof value !== "string") return null;
  const host = value.trim().toLowerCase();
  if (host.startsWith("[")) {
    const close = host.indexOf("]");
    if (close <= 1) return null;
    const suffix = host.slice(close + 1);
    if (suffix !== "" && !/^:\d+$/.test(suffix)) return null;
    return host.slice(1, close);
  }
  const firstColon = host.indexOf(":");
  const lastColon = host.lastIndexOf(":");
  if (firstColon !== lastColon) return host;
  if (lastColon === -1) return host.replace(/\.$/, "");
  if (!/^\d+$/.test(host.slice(lastColon + 1))) return null;
  return host.slice(0, lastColon).replace(/\.$/, "");
}
function rejectForeignCaller(req, res) {
  if (req.method !== "GET") {
    json(res, 405, { ok: false, error: "method-not-allowed" });
    return true;
  }
  const peer = req.socket?.remoteAddress;
  const host = hostNameOf(req.headers?.host);
  const hostOk = host === "localhost" || isLoopbackAddress(host);
  if (isLoopbackAddress(peer) && hostOk) return false;
  json(res, 403, { ok: false, error: "forbidden" });
  return true;
}
async function loadSession(ctx, sessionId) {
  const sessions = ctx.get("sessions");
  if (sessions !== void 0 && typeof sessions.list === "function") {
    try {
      const live = sessions.list().find((entry) => entry.id === sessionId);
      if (live !== void 0 && Array.isArray(live.events)) {
        const header = {
          id: sessionId,
          version: 0,
          createdAt: typeof live.createdAt === "number" ? live.createdAt : live.events[0]?.time ?? 0,
          ...typeof live.cwd === "string" ? { cwd: live.cwd } : {}
        };
        return { events: live.events, header, live: true };
      }
    } catch (error) {
      ctx.logger?.warn?.(`session-lens: live session lookup failed: ${String(error)}`);
    }
  }
  const persistence = ctx.get("sessionPersistence");
  if (persistence !== void 0 && typeof persistence.readFrom === "function") {
    try {
      const result = await persistence.readFrom(sessionId, 0);
      if (Array.isArray(result?.events)) {
        let header = result.header ?? null;
        if (header === null && typeof persistence.list === "function") {
          try {
            const metas = await persistence.list();
            const meta = metas.find((entry) => entry.id === sessionId);
            if (meta !== void 0) {
              header = {
                id: sessionId,
                version: 0,
                createdAt: typeof meta.createdAt === "number" ? meta.createdAt : result.events[0]?.time ?? 0,
                ...typeof meta.cwd === "string" ? { cwd: meta.cwd } : {}
              };
            }
          } catch {
          }
        }
        return { events: result.events, header, live: false };
      }
    } catch (error) {
      ctx.logger?.warn?.(`session-lens: persisted read failed for "${sessionId}": ${String(error)}`);
    }
  }
  return null;
}
function sessionIdFrom(req) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const id = url.searchParams.get("sessionId") ?? "";
  return SESSION_ID_PATTERN.test(id) ? id : null;
}
async function handleAnalytics(ctx, req, res) {
  if (rejectForeignCaller(req, res)) return;
  const sessionId = sessionIdFrom(req);
  if (sessionId === null) {
    json(res, 400, { ok: false, error: "bad-session-id" });
    return;
  }
  try {
    const loaded = await loadSession(ctx, sessionId);
    if (loaded === null) {
      json(res, 404, { ok: false, error: "session-not-found", sessionId });
      return;
    }
    const analytics = analyzeSession(loaded.events, loaded.header, sessionId);
    json(res, 200, { ok: true, live: loaded.live, analytics });
  } catch (error) {
    ctx.logger?.warn?.(`session-lens: analytics failed: ${String(error)}`);
    json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
  }
}
async function handleExport(ctx, req, res) {
  if (rejectForeignCaller(req, res)) return;
  const sessionId = sessionIdFrom(req);
  if (sessionId === null) {
    json(res, 400, { ok: false, error: "bad-session-id" });
    return;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const lang = url.searchParams.get("lang") === "en" ? "en" : "zh";
  const full = url.searchParams.get("full") === "1";
  const mask = url.searchParams.get("mask") !== "0";
  const themeParam = url.searchParams.get("theme");
  const theme = themeParam === "system" || themeParam === "light" ? themeParam : "dark";
  try {
    const loaded = await loadSession(ctx, sessionId);
    if (loaded === null) {
      json(res, 404, { ok: false, error: "session-not-found", sessionId });
      return;
    }
    const html = renderSessionHtml(loaded.events, void 0, loaded.header, {
      cwd: loaded.header?.cwd ?? null,
      // Tool payloads routinely embed install/cache paths under the user's
      // home (npm-cache, ~/.dsh/…) — mask those to `~` alongside the cwd.
      extraPaths: [homedir()],
      lang,
      theme,
      maskPaths: mask,
      maxTextLength: full ? null : 2e3
    });
    const filename = `dsh-session-${sessionId.slice(0, 8)}.html`;
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-cache"
    });
    res.end(html);
  } catch (error) {
    ctx.logger?.warn?.(`session-lens: export failed: ${String(error)}`);
    json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
  }
}
function apply(ctx) {
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: ANALYTICS_PATH,
      handler: (req, res) => handleAnalytics(ctx, req, res)
    }),
    "session-lens: analytics route"
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: EXPORT_PATH,
      handler: (req, res) => handleExport(ctx, req, res)
    }),
    "session-lens: export route"
  );
}
export {
  ANALYTICS_PATH,
  EXPORT_PATH,
  apply,
  inject,
  name
};
