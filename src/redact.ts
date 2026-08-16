/**
 * Privacy redaction for session export.
 *
 * Structural guarantee: the export replay renders ONLY a whitelist of
 * "story" events (user/assistant messages, tool calls, turn markers, …).
 * `request/header` (system prompt), `request/context`, `llm/*` and every
 * `*-llm-request` event can never appear in an export — there is no toggle
 * for them. On top of that, this module applies content-level redaction to
 * the whitelisted events:
 *
 * - Tool call arguments and tool result text are truncated (file writes and
 *   shell output are the biggest leak vectors). `maxTextLength: null` keeps
 *   full text.
 * - The session cwd AND the user's home directory (plus their slash/escape
 *   variants) are replaced with `~` in every string inside event data — tool
 *   payloads routinely embed install/cache paths under both.
 * - Image blocks are replaced with a text placeholder (attachment bytes
 *   never leave the machine).
 *
 * Pure functions; events are never mutated — redacted copies share structure
 * with the input where untouched.
 */

import { asRecord, type ContentBlock, type SessionEvent } from "./events.ts";

export interface RedactOptions {
  /** Session cwd, used for path masking. */
  cwd?: string | null;
  /** Extra path prefixes to mask (e.g. the user's home directory — skill
   * and tool payloads routinely embed install/cache paths under it). */
  extraPaths?: Array<string | null | undefined>;
  /** Replace cwd occurrences with `~`. Default true. */
  maskPaths?: boolean;
  /** Truncate tool arguments/results to this many chars; null keeps full. Default 2000. */
  maxTextLength?: number | null;
}

export const REDACT_DEFAULTS: Required<Omit<RedactOptions, "cwd" | "extraPaths" | "maxTextLength">> & {
  maxTextLength: number | null;
} = {
  maskPaths: true,
  maxTextLength: 2000,
};

/** Events the export replay may render. Anything else is dropped. */
export const STORY_EVENT_TYPES: ReadonlySet<string> = new Set([
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
  "feedback/record",
]);

/** Keep only story events (stable seq order preserved). */
export function filterStoryEvents(events: SessionEvent[]): SessionEvent[] {
  return events.filter((event) => STORY_EVENT_TYPES.has(event.type));
}

/**
 * Path spellings worth masking for ONE base path: raw plus slash-flipped
 * variants, drive-letter case flips, and JSON-escaped forms (`\` doubled) —
 * tool call arguments are UNPARSED JSON strings, so a Windows path surfaces
 * there as `D:\\work\\proj`.
 */
export function collectPathVariants(cwd: string | null | undefined): string[] {
  if (typeof cwd !== "string" || cwd.length < 3) return [];
  const variants = new Set<string>();
  variants.add(cwd);
  if (cwd.includes("\\")) variants.add(cwd.replace(/\\/g, "/"));
  if (cwd.includes("/")) variants.add(cwd.replace(/\//g, "\\"));
  // A Windows drive path may also surface uppercased in tool output.
  for (const v of [...variants]) {
    if (/^[a-z]:/i.test(v)) variants.add(v[0]!.toUpperCase() + v.slice(1));
    if (/^[A-Z]:/.test(v)) variants.add(v[0]!.toLowerCase() + v.slice(1));
  }
  for (const v of [...variants]) {
    if (v.includes("\\")) variants.add(v.replace(/\\/g, "\\\\"));
  }
  // Longest first so overlapping variants mask deterministically.
  return [...variants].sort((a, b) => b.length - a.length);
}

/** Variants for several base paths (cwd, home dir, …), deduped, longest first. */
export function collectAllVariants(paths: Array<string | null | undefined>): string[] {
  const all = new Set<string>();
  for (const p of paths) {
    for (const v of collectPathVariants(p)) all.add(v);
  }
  return [...all].sort((a, b) => b.length - a.length);
}

/** Mask every path variant inside `text` with `~`. */
export function maskText(text: string, variants: string[]): string {
  let out = text;
  for (const variant of variants) {
    if (variant.length > 0 && out.includes(variant)) {
      out = out.split(variant).join("~");
    }
  }
  return out;
}

function truncate(text: string, max: number | null): string {
  if (max === null || text.length <= max) return text;
  const omitted = text.length - max;
  return `${text.slice(0, max)}\n…[+${omitted} chars]`;
}

function redactValue(value: unknown, variants: string[], max: number | null, inToolPayload: boolean): unknown {
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
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(rec)) {
      out[key] = redactValue(item, variants, max, inToolPayload);
    }
    return out;
  }
  return value;
}

function redactBlocks(blocks: ContentBlock[] | undefined, variants: string[], max: number | null, truncateText: boolean): ContentBlock[] | undefined {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((block) => {
    if (block.type === "image") {
      return { type: "text", text: "[image · 图片未导出]" } as ContentBlock;
    }
    const rec = asRecord(block);
    if (rec === null) return block;
    const out: Record<string, unknown> = { ...rec };
    if (typeof out.text === "string") {
      let text = out.text;
      if (variants.length > 0) text = maskText(text, variants);
      // Message text is the user's/agent's own prose: mask paths, but only
      // truncate when this block belongs to a tool result payload.
      if (truncateText) text = truncate(text, max);
      out.text = text;
    }
    // tool-call blocks carry UNPARSED JSON in `arguments` — a tool payload
    // embedded in assistant messages. Mask AND truncate it like any tool
    // payload; without this, paths/file contents leak through the replay.
    if (typeof out.arguments === "string") {
      let args = out.arguments;
      if (variants.length > 0) args = maskText(args, variants);
      out.arguments = truncate(args, max);
    }
    return out as unknown as ContentBlock;
  });
}

/**
 * Redact one event for export. Tool payloads (`tool/call` arguments,
 * `tool/result` content) get path-masking AND truncation; message events get
 * path-masking only; image blocks always become placeholders.
 */
export function redactEvent(event: SessionEvent, options: RedactOptions = {}): SessionEvent {
  const maskPaths = options.maskPaths ?? REDACT_DEFAULTS.maskPaths;
  const max = options.maxTextLength === undefined ? REDACT_DEFAULTS.maxTextLength : options.maxTextLength;
  const variants = maskPaths ? collectAllVariants([options.cwd, ...(options.extraPaths ?? [])]) : [];
  const data = asRecord(event.data);
  if (data === null) return event;

  if (event.type === "tool/call" || event.type === "tool/result") {
    return { ...event, data: redactValue(data, variants, max, true) as typeof event.data };
  }
  if (event.type === "user/message" || event.type === "assistant/message") {
    // Content blocks may be flat (repo HEAD) or nested under `message`
    // (rc.6); redact both locations.
    const flat = Array.isArray(data.content) ? (data.content as ContentBlock[]) : undefined;
    const message = asRecord(data.message);
    const nested = message !== null && Array.isArray(message.content) ? (message.content as ContentBlock[]) : undefined;
    return {
      ...event,
      data: {
        ...data,
        ...(flat !== undefined ? { content: redactBlocks(flat, variants, max, false) } : {}),
        ...(message !== null
          ? { message: { ...message, content: redactBlocks(nested, variants, max, false) } }
          : {}),
      } as typeof event.data,
    };
  }
  // Markers (approval/todo/plan/…): mask paths in any string field.
  if (variants.length > 0) {
    return { ...event, data: redactValue(data, variants, null, false) as typeof event.data };
  }
  return event;
}

/** Redact a whole event list. */
export function redactEvents(events: SessionEvent[], options: RedactOptions = {}): SessionEvent[] {
  return events.map((event) => redactEvent(event, options));
}
