/** `session-lens` namespace dictionaries (view tab label + panel strings). */

export const NS = "session-lens";

export type LensKey =
  | "view.lens"
  | "toolbar.refresh"
  | "toolbar.export"
  | "toolbar.fullResults"
  | "toolbar.maskPaths"
  | "toolbar.lang"
  | "toolbar.live"
  | "state.loading"
  | "state.error"
  | "state.notFound"
  | "state.retry"
  | "stats.tokens"
  | "stats.input"
  | "stats.output"
  | "stats.cacheRead"
  | "stats.cacheWrite"
  | "stats.reasoning"
  | "stats.compaction"
  | "stats.total"
  | "stats.perTurn"
  | "stats.turn"
  | "stats.duration"
  | "stats.toolCalls"
  | "stats.errors"
  | "stats.tools"
  | "stats.tool"
  | "stats.calls"
  | "stats.activity"
  | "stats.compactions"
  | "stats.shadowed"
  | "stats.approvals"
  | "stats.subagents"
  | "stats.retries"
  | "overview.turns"
  | "overview.messages"
  | "overview.events"
  | "overview.status.active";

export const zh: Record<LensKey, string> = {
  "view.lens": "洞察",
  "toolbar.refresh": "刷新",
  "toolbar.export": "导出 HTML",
  "toolbar.fullResults": "完整工具结果",
  "toolbar.maskPaths": "路径脱敏",
  "toolbar.lang": "English",
  "toolbar.live": "实时",
  "state.loading": "加载会话数据…",
  "state.error": "加载失败",
  "state.notFound": "找不到该会话（可能尚未产生事件）",
  "state.retry": "重试",
  "stats.tokens": "Token 用量",
  "stats.input": "输入",
  "stats.output": "输出",
  "stats.cacheRead": "缓存读",
  "stats.cacheWrite": "缓存写",
  "stats.reasoning": "思维链",
  "stats.compaction": "压缩调用",
  "stats.total": "合计",
  "stats.perTurn": "按 Turn 分解",
  "stats.turn": "Turn",
  "stats.duration": "时长",
  "stats.toolCalls": "工具调用",
  "stats.errors": "错误",
  "stats.tools": "工具统计",
  "stats.tool": "工具",
  "stats.calls": "调用",
  "stats.activity": "活动统计",
  "stats.compactions": "上下文压缩",
  "stats.shadowed": "遮蔽 token",
  "stats.approvals": "审批(通过/请求)",
  "stats.subagents": "子 Agent",
  "stats.retries": "LLM 重试",
  "overview.turns": "Turn 数",
  "overview.messages": "消息数",
  "overview.events": "事件数",
  "overview.status.active": "进行中",
};

export const en: Record<LensKey, string> = {
  "view.lens": "Lens",
  "toolbar.refresh": "Refresh",
  "toolbar.export": "Export HTML",
  "toolbar.fullResults": "Full tool results",
  "toolbar.maskPaths": "Mask paths",
  "toolbar.lang": "中文",
  "toolbar.live": "live",
  "state.loading": "Loading session data…",
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
  "overview.status.active": "active",
};
