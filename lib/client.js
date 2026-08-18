window.__ModuleLoader__.load({
	id: "dsh-session-lens",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/locales.ts
var NS = "session-lens";
var zh = {
  "view.lens": "\u6D1E\u5BDF",
  "toolbar.refresh": "\u5237\u65B0",
  "toolbar.export": "\u5BFC\u51FA HTML",
  "toolbar.fullResults": "\u5B8C\u6574\u5DE5\u5177\u7ED3\u679C",
  "toolbar.maskPaths": "\u8DEF\u5F84\u8131\u654F",
  "toolbar.lang": "English",
  "toolbar.theme": "\u5BFC\u51FA\u4E3B\u9898",
  "toolbar.themeSystem": "\u8DDF\u968F\u7CFB\u7EDF",
  "toolbar.themeDark": "\u6DF1\u8272",
  "toolbar.themeLight": "\u6D45\u8272",
  "toolbar.live": "\u5B9E\u65F6",
  "state.loading": "\u52A0\u8F7D\u4F1A\u8BDD\u6570\u636E\u2026",
  "state.error": "\u52A0\u8F7D\u5931\u8D25",
  "state.notFound": "\u627E\u4E0D\u5230\u8BE5\u4F1A\u8BDD\uFF08\u53EF\u80FD\u5C1A\u672A\u4EA7\u751F\u4E8B\u4EF6\uFF09",
  "state.retry": "\u91CD\u8BD5",
  "stats.tokens": "Token \u7528\u91CF",
  "stats.input": "\u8F93\u5165",
  "stats.output": "\u8F93\u51FA",
  "stats.cacheRead": "\u7F13\u5B58\u8BFB",
  "stats.cacheWrite": "\u7F13\u5B58\u5199",
  "stats.reasoning": "\u601D\u7EF4\u94FE",
  "stats.compaction": "\u538B\u7F29\u8C03\u7528",
  "stats.total": "\u5408\u8BA1",
  "stats.perTurn": "\u6309 Turn \u5206\u89E3",
  "stats.turn": "Turn",
  "stats.duration": "\u65F6\u957F",
  "stats.toolCalls": "\u5DE5\u5177\u8C03\u7528",
  "stats.errors": "\u9519\u8BEF",
  "stats.tools": "\u5DE5\u5177\u7EDF\u8BA1",
  "stats.tool": "\u5DE5\u5177",
  "stats.calls": "\u8C03\u7528",
  "stats.activity": "\u6D3B\u52A8\u7EDF\u8BA1",
  "stats.compactions": "\u4E0A\u4E0B\u6587\u538B\u7F29",
  "stats.shadowed": "\u906E\u853D token",
  "stats.approvals": "\u5BA1\u6279(\u901A\u8FC7/\u8BF7\u6C42)",
  "stats.subagents": "\u5B50 Agent",
  "stats.retries": "LLM \u91CD\u8BD5",
  "overview.turns": "Turn \u6570",
  "overview.messages": "\u6D88\u606F\u6570",
  "overview.events": "\u4E8B\u4EF6\u6570",
  "overview.status.active": "\u8FDB\u884C\u4E2D"
};
var en = {
  "view.lens": "Lens",
  "toolbar.refresh": "Refresh",
  "toolbar.export": "Export HTML",
  "toolbar.fullResults": "Full tool results",
  "toolbar.maskPaths": "Mask paths",
  "toolbar.lang": "\u4E2D\u6587",
  "toolbar.theme": "Export theme",
  "toolbar.themeSystem": "System",
  "toolbar.themeDark": "Dark",
  "toolbar.themeLight": "Light",
  "toolbar.live": "live",
  "state.loading": "Loading session data\u2026",
  "state.error": "Failed to load",
  "state.notFound": "Session not found (no events yet?)",
  "state.retry": "Retry",
  "stats.tokens": "Token usage",
  "stats.input": "Input",
  "stats.output": "Output",
  "stats.cacheRead": "Cache read",
  "stats.cacheWrite": "Cache write",
  "stats.reasoning": "Reasoning",
  "stats.compaction": "Compaction",
  "stats.total": "Total",
  "stats.perTurn": "Per-turn breakdown",
  "stats.turn": "Turn",
  "stats.duration": "Duration",
  "stats.toolCalls": "Tool calls",
  "stats.errors": "Errors",
  "stats.tools": "Tool stats",
  "stats.tool": "Tool",
  "stats.calls": "Calls",
  "stats.activity": "Activity",
  "stats.compactions": "Compactions",
  "stats.shadowed": "Shadowed tokens",
  "stats.approvals": "Approvals (ok/asked)",
  "stats.subagents": "Subagents",
  "stats.retries": "LLM retries",
  "overview.turns": "Turns",
  "overview.messages": "Messages",
  "overview.events": "Events",
  "overview.status.active": "active"
};

// src/client/lens-view.tsx
var import_react = require("react");

// src/analytics.ts
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

// src/client/styles.ts
var LENS_CSS = `
.lens-root{--lens-text:light-dark(#1f2937,#dde2e8);--lens-secondary:light-dark(#5f6877,#a7b0bc);--lens-tertiary:light-dark(#778193,#8a94a1);--lens-surface:light-dark(#ffffff,#22262d);--lens-surface-muted:light-dark(#f5f7fa,#262b33);--lens-border:light-dark(#dce2ea,#2c313a);--lens-hover:light-dark(#eef4ff,#22262d);--lens-shadow:light-dark(0 1px 2px rgba(15,23,42,.04),0 0 transparent);padding:16px 20px 28px;font-size:13px;color:var(--dsw-alias-label-primary,var(--lens-text));max-width:920px;margin:0 auto}
body[data-ds-dark-theme] .lens-root{--lens-text:#dde2e8;--lens-secondary:#a7b0bc;--lens-tertiary:#8a94a1;--lens-surface:#22262d;--lens-surface-muted:#262b33;--lens-border:#2c313a;--lens-hover:#22262d;--lens-shadow:0 0 transparent}
.lens-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.lens-title{font-size:15px;font-weight:650;margin-right:auto;display:flex;align-items:center;gap:8px;min-width:0}
.lens-title span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lens-live{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#34c98e;font-weight:600}
.lens-live::before{content:"";width:7px;height:7px;border-radius:50%;background:#34c98e;animation:lens-pulse 1.6s infinite}
@keyframes lens-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.lens-btn{border:1px solid var(--dsw-alias-border-primary,var(--lens-border));background:var(--dsw-alias-bg-primary,var(--lens-surface));color:inherit;border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:inherit;box-shadow:var(--lens-shadow);transition:background-color .15s ease,border-color .15s ease}
.lens-btn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--lens-hover));border-color:light-dark(#b9cced,#3a414c)}
.lens-btn-primary{background:var(--dsw-alias-interactive-bg-brand,#4c8dff);border-color:transparent;color:#fff}
.lens-btn-primary:hover{background:var(--dsw-alias-interactive-bg-brand-hover,#3b7af0)}
.lens-select{border:1px solid var(--dsw-alias-border-primary,var(--lens-border));background:var(--dsw-alias-bg-primary,var(--lens-surface));color:inherit;border-radius:8px;padding:4px 6px;font-size:12px;font-family:inherit;box-shadow:var(--lens-shadow)}
.lens-check{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary,var(--lens-secondary));cursor:pointer;user-select:none}
.lens-chips{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}
.lens-chip{background:var(--dsw-alias-bg-secondary,var(--lens-surface));border:1px solid var(--dsw-alias-border-secondary,var(--lens-border));border-radius:10px;padding:8px 14px;min-width:92px;box-shadow:var(--lens-shadow)}
.lens-chip-value{font-size:16px;font-weight:650;font-variant-numeric:tabular-nums}
.lens-chip-label{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--lens-tertiary))}
.lens-section{margin-top:18px}
.lens-section h3{font-size:12px;font-weight:650;color:var(--dsw-alias-label-tertiary,var(--lens-tertiary));text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px}
.lens-bar{width:100%;border-radius:6px;overflow:hidden;display:block;background:var(--dsw-alias-bg-tertiary,var(--lens-surface-muted))}
.lens-legend{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px;font-size:12px;color:var(--dsw-alias-label-secondary,var(--lens-secondary))}
.lens-dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px}
.lens-table{width:100%;border-collapse:collapse;font-size:12px;background:var(--dsw-alias-bg-secondary,var(--lens-surface));border:1px solid var(--dsw-alias-border-secondary,var(--lens-border));border-radius:10px;overflow:hidden;box-shadow:var(--lens-shadow)}
.lens-table th,.lens-table td{text-align:left;padding:6px 12px;border-bottom:1px solid var(--dsw-alias-border-secondary,var(--lens-surface-muted));font-variant-numeric:tabular-nums}
.lens-table th{color:var(--dsw-alias-label-tertiary,var(--lens-tertiary));font-weight:600;background:light-dark(#f8fafc,#22262d)}
.lens-table tr:last-child td{border-bottom:none}
.lens-table tbody tr:hover{background:light-dark(#f8fbff,#22262d)}
.lens-table code{background:var(--dsw-alias-bg-tertiary,var(--lens-surface-muted));border-radius:5px;padding:1px 6px}
.lens-err{color:#e3635a}
.lens-activity{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--dsw-alias-label-secondary,var(--lens-secondary))}
.lens-state{padding:48px 0;text-align:center;color:var(--dsw-alias-label-tertiary,var(--lens-tertiary))}
.lens-state button{margin-top:10px}
`;
var injected = false;
function ensureLensStyles() {
  if (injected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.dataset.sessionLens = "true";
  style.textContent = LENS_CSS;
  document.head.appendChild(style);
  injected = true;
}

// src/client/lens-view.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var OPTS_KEY = "dsh-session-lens:export-opts";
function loadOpts() {
  try {
    const raw = globalThis.localStorage?.getItem(OPTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        full: parsed.full === true,
        mask: parsed.mask !== false,
        lang: parsed.lang === "en" ? "en" : "zh",
        theme: parsed.theme === "system" || parsed.theme === "light" ? parsed.theme : "dark"
      };
    }
  } catch {
  }
  return { full: false, mask: true, lang: "zh", theme: "dark" };
}
function saveOpts(opts) {
  try {
    globalThis.localStorage?.setItem(OPTS_KEY, JSON.stringify(opts));
  } catch {
  }
}
var TOKEN_SEGMENTS = [
  { key: "input", labelKey: "stats.input", color: "#4c8dff" },
  { key: "output", labelKey: "stats.output", color: "#34c98e" },
  { key: "cacheRead", labelKey: "stats.cacheRead", color: "#8b7cf6" },
  { key: "cacheWrite", labelKey: "stats.cacheWrite", color: "#c9a0f6" },
  { key: "reasoning", labelKey: "stats.reasoning", color: "#f6a35c" }
];
function TokenBar({ tokens, t }) {
  const segments = TOKEN_SEGMENTS.map((seg) => ({
    ...seg,
    value: tokens[seg.key]
  })).filter((seg) => seg.value > 0);
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  if (total === 0) return null;
  const width = 720;
  let x = 0;
  const rects = segments.map((seg) => {
    const w = Math.max(2, Math.round(seg.value / total * width));
    const rect = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x, y: 0, width: Math.min(w, width - x), height: 22, fill: seg.color, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: `${t(seg.labelKey)} ${formatTokens(seg.value)}` }) }, seg.key);
    x += w;
    return rect;
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { viewBox: `0 0 ${width} 22`, className: "lens-bar", role: "img", children: rects }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "lens-legend", children: segments.map((seg) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "lens-dot", style: { background: seg.color } }),
      t(seg.labelKey),
      " ",
      formatTokens(seg.value)
    ] }, seg.key)) })
  ] });
}
function Chip({ label, value }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lens-chip", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "lens-chip-value", children: value }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "lens-chip-label", children: label })
  ] });
}
function AnalyticsView({ analytics, t }) {
  const act = analytics.activity;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lens-chips", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { label: t("stats.total"), value: formatTokens(analytics.tokens.total) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { label: t("stats.input"), value: formatTokens(analytics.tokens.input) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { label: t("stats.output"), value: formatTokens(analytics.tokens.output) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { label: t("stats.cacheRead"), value: formatTokens(analytics.tokens.cacheRead) }),
      analytics.tokens.cacheWrite > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { label: t("stats.cacheWrite"), value: formatTokens(analytics.tokens.cacheWrite) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { label: t("stats.reasoning"), value: formatTokens(analytics.tokens.reasoning) }),
      analytics.compactionTokens !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { label: t("stats.compaction"), value: formatTokens(analytics.compactionTokens.total) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { label: t("overview.turns"), value: String(analytics.turns) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { label: t("stats.duration"), value: formatDuration(analytics.durationMs) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lens-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: t("stats.tokens") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TokenBar, { tokens: analytics.tokens, t })
    ] }),
    analytics.perTurn.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lens-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: t("stats.perTurn") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { className: "lens-table", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("stats.turn") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("stats.duration") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", { children: [
            t("stats.input"),
            "+Cache"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("stats.output") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("stats.reasoning") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("stats.toolCalls") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: analytics.perTurn.map((turn) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
            "#",
            turn.turn
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: formatDuration(turn.durationMs) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: formatTokens(turn.input + turn.cacheRead + turn.cacheWrite) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: formatTokens(turn.output) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: turn.reasoning > 0 ? formatTokens(turn.reasoning) : "\u2014" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
            turn.toolCalls,
            turn.toolErrors > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "lens-err", children: ` (${turn.toolErrors} ${t("stats.errors")})` })
          ] })
        ] }, turn.turn)) })
      ] })
    ] }),
    analytics.tools.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lens-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: t("stats.tools") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { className: "lens-table", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("stats.tool") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("stats.calls") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("stats.errors") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "OK%" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("stats.duration") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: analytics.tools.map((tool) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: tool.name }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: tool.calls }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: tool.errors > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "lens-err", children: tool.errors }) : "0" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
            tool.calls > 0 ? Math.round((tool.calls - tool.errors) / tool.calls * 100) : 100,
            "%"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: formatDuration(tool.totalDurationMs) })
        ] }, tool.name)) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lens-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: t("stats.activity") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lens-activity", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: act.compactions }),
          " ",
          t("stats.compactions")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: act.compactionShadowedTokens > 0 ? formatTokens(act.compactionShadowedTokens) : "\u2014" }),
          " ",
          t("stats.shadowed")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [
            act.approvalsApproved,
            "/",
            act.approvalsAsked
          ] }),
          " ",
          t("stats.approvals")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: act.subagents }),
          " ",
          t("stats.subagents")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: act.llmRetries }),
          " ",
          t("stats.retries")
        ] })
      ] })
    ] })
  ] });
}
function LensView({ sessionId, t }) {
  ensureLensStyles();
  const [data, setData] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [opts, setOpts] = (0, import_react.useState)(loadOpts);
  const load = (0, import_react.useCallback)(async () => {
    try {
      const res = await fetch(`/api/session-lens/analytics?sessionId=${encodeURIComponent(sessionId)}`);
      const body = await res.json();
      if (body.ok && body.analytics) {
        setData({ analytics: body.analytics, live: body.live === true });
        setError(null);
      } else {
        setError(body.error === "session-not-found" ? "not-found" : body.message ?? body.error ?? "unknown");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);
  (0, import_react.useEffect)(() => {
    setLoading(true);
    void load();
  }, [load]);
  const live = data?.live === true;
  (0, import_react.useEffect)(() => {
    if (!live) return;
    const timer = setInterval(() => void load(), 5e3);
    return () => clearInterval(timer);
  }, [live, load]);
  const updateOpts = (patch) => {
    setOpts((prev) => {
      const next = { ...prev, ...patch };
      saveOpts(next);
      return next;
    });
  };
  const exportUrl = `/api/session-lens/export?sessionId=${encodeURIComponent(sessionId)}&lang=${opts.lang}&full=${opts.full ? 1 : 0}&mask=${opts.mask ? 1 : 0}&theme=${opts.theme}`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lens-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lens-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lens-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: data?.analytics.title ?? sessionId }),
        live && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "lens-live", children: t("toolbar.live") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "lens-check", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            checked: opts.full,
            onChange: (event) => updateOpts({ full: event.target.checked })
          }
        ),
        t("toolbar.fullResults")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "lens-check", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            checked: opts.mask,
            onChange: (event) => updateOpts({ mask: event.target.checked })
          }
        ),
        t("toolbar.maskPaths")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: "lens-btn",
          onClick: () => updateOpts({ lang: opts.lang === "zh" ? "en" : "zh" }),
          children: t("toolbar.lang")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "select",
        {
          className: "lens-select",
          "aria-label": t("toolbar.theme"),
          value: opts.theme,
          onChange: (event) => updateOpts({ theme: event.target.value }),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "dark", children: t("toolbar.themeDark") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "system", children: t("toolbar.themeSystem") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "light", children: t("toolbar.themeLight") })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "lens-btn", onClick: () => void load(), children: t("toolbar.refresh") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { className: "lens-btn lens-btn-primary", href: exportUrl, download: true, children: t("toolbar.export") })
    ] }),
    loading && data === null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "lens-state", children: t("state.loading") }),
    error !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lens-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: error === "not-found" ? t("state.notFound") : `${t("state.error")}: ${error}` }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "lens-btn", onClick: () => void load(), children: t("state.retry") })
    ] }),
    data !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnalyticsView, { analytics: data.analytics, t })
  ] });
}

// src/client/index.tsx
var name = "session-lens";
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "session-lens: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.slots.inject(
    "conversation.view",
    () => ctx.slots.register(
      {
        name: "conversation.view",
        id: "session-lens",
        order: 20,
        locale: NS,
        label: () => t("view.lens"),
        inject: (sessionId) => ({
          sessionId,
          t
        })
      },
      LensView
    )
  );
}
		return module.exports;
	}
});
