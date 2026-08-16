/**
 * Session event model (format version 0), mirrored from
 * deepseek-ai/deepseek-harness `packages/core/session/src/types.ts` and the
 * on-disk JSONL encoding (`chunk-rows.ts`). Structurally typed on purpose:
 * the plugin must not depend on @deepseek-ai/* packages at runtime.
 *
 * Input sources (`sessions` live service, `sessionPersistence.readFrom`,
 * `sessionQuery.readSession`) all return EXPANDED events; packed rows
 * (`text-chunks` / `reasoning-chunks` / `tool-call-chunks`) only exist on
 * disk. `parseSessionJsonl` expands them so tests can consume raw log files.
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
}

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ReasoningBlock {
  type: "reasoning";
  text: string;
}

export interface ToolCallBlock {
  type: "tool-call";
  id: string;
  name: string;
  /** Unparsed JSON string. */
  arguments: string;
}

export interface ImageBlock {
  type: "image";
  attachmentId?: string;
  mediaType?: string;
  name?: string;
  [key: string]: unknown;
}

export type ContentBlock = TextBlock | ReasoningBlock | ToolCallBlock | ImageBlock | { type: string; [key: string]: unknown };

export interface SessionEvent {
  type: string;
  seq: number;
  time: number;
  data?: unknown;
  ignorable?: true;
  sourceEventSeqs?: number[];
  surfaceOp?: unknown;
}

export interface SessionHeader {
  id: string;
  version: number;
  createdAt: number;
  cwd?: string;
}

export interface ParsedSessionLog {
  header: SessionHeader | null;
  events: SessionEvent[];
}

/** data of an `assistant/message` event. Two shapes exist in the wild:
 * repo-HEAD logs put `content`/`provenance` directly on data, while the
 * rc.6 npm build nests them under `data.message`. `usage` is top-level in
 * both. Use the accessors below instead of reading fields directly. */
export interface AssistantMessageData {
  turn: number;
  step: number;
  content?: ContentBlock[];
  message?: { role?: string; content?: ContentBlock[]; provenance?: MessageProvenance };
  provenance?: MessageProvenance;
  usage?: TokenUsage;
}

export interface MessageProvenance {
  provider?: string;
  model?: string;
}

/** data of a `user/message` event. */
export interface UserMessageData {
  content: ContentBlock[];
  source?: { kind?: string; [key: string]: unknown };
}

export interface ToolCallData {
  turn: number;
  step: number;
  callId: string;
  name: string;
  arguments: string;
}

/** data of a `tool/result` event. rc.6 nests the payload under `message`
 * (callId at `message.source.callId`, text inside `tool-result` blocks that
 * wrap their own content arrays); repo HEAD keeps `content`/`callId` flat. */
export interface ToolResultData {
  turn: number;
  step: number;
  callId?: string;
  content?: ContentBlock[];
  message?: {
    source?: { kind?: string; callId?: string };
    content?: ContentBlock[];
    isError?: boolean;
  };
  isError?: boolean;
  error?: { name?: string; code?: string };
  meta?: unknown;
}

/** Type guard helper: narrow data to an object record. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Assistant message content blocks, shape-tolerant. */
export function assistantContent(data: unknown): ContentBlock[] | undefined {
  const rec = asRecord(data);
  if (rec === null) return undefined;
  if (Array.isArray(rec.content)) return rec.content as ContentBlock[];
  const message = asRecord(rec.message);
  if (message !== null && Array.isArray(message.content)) return message.content as ContentBlock[];
  return undefined;
}

/** Assistant message usage (top-level in every observed shape). */
export function assistantUsage(data: unknown): TokenUsage | undefined {
  const rec = asRecord(data);
  const usage = asRecord(rec?.usage);
  return usage === null ? undefined : (usage as unknown as TokenUsage);
}

/** Assistant message provenance (flat or nested under message). */
export function assistantProvenance(data: unknown): MessageProvenance | undefined {
  const rec = asRecord(data);
  const flat = asRecord(rec?.provenance);
  if (flat !== null) return flat as MessageProvenance;
  const message = asRecord(rec?.message);
  const nested = asRecord(message?.provenance);
  return nested === null ? undefined : (nested as MessageProvenance);
}

/** Tool result callId: flat, message.source.callId, or the first
 * tool-result block's toolCallId. */
export function toolResultCallId(data: unknown): string | undefined {
  const rec = asRecord(data);
  if (rec === null) return undefined;
  if (typeof rec.callId === "string") return rec.callId;
  const message = asRecord(rec.message);
  const source = asRecord(message?.source);
  if (typeof source?.callId === "string") return source.callId;
  if (Array.isArray(message?.content)) {
    for (const block of message.content as ContentBlock[]) {
      const b = asRecord(block);
      if (typeof b?.toolCallId === "string") return b.toolCallId;
    }
  }
  return undefined;
}

/** Tool result error flag (flat, nested, or an error object). */
export function toolResultIsError(data: unknown): boolean {
  const rec = asRecord(data);
  if (rec === null) return false;
  if (rec.isError === true) return true;
  const message = asRecord(rec.message);
  if (message?.isError === true) return true;
  return asRecord(rec.error) !== null;
}

/** Tool result content blocks. The nested shape wraps text inside
 * `tool-result` blocks; flatten those one level for rendering. */
export function toolResultContent(data: unknown): ContentBlock[] | undefined {
  const rec = asRecord(data);
  if (rec === null) return undefined;
  if (Array.isArray(rec.content)) return rec.content as ContentBlock[];
  const message = asRecord(rec.message);
  if (message !== null && Array.isArray(message.content)) {
    const out: ContentBlock[] = [];
    for (const block of message.content as ContentBlock[]) {
      const b = asRecord(block);
      if (b !== null && b.type === "tool-result" && Array.isArray(b.content)) {
        out.push(...(b.content as ContentBlock[]));
      } else {
        out.push(block);
      }
    }
    return out;
  }
  return undefined;
}

/** Provider/model from a `request/context` event (or null fields). */
export function requestContextInfo(data: unknown): { provider?: string; model?: string } {
  const rec = asRecord(data);
  if (rec === null) return {};
  return {
    ...(typeof rec.provider === "string" ? { provider: rec.provider } : {}),
    ...(typeof rec.model === "string" ? { model: rec.model } : {}),
  };
}

/** Provider/model from a `request/header` event's config (fallback source). */
export function requestHeaderInfo(data: unknown): { provider?: string; model?: string } {
  const rec = asRecord(data);
  const header = asRecord(rec?.header);
  const config = asRecord(header?.config);
  if (config === null) return {};
  return {
    ...(typeof config.provider === "string" ? { provider: config.provider } : {}),
    ...(typeof config.model === "string" ? { model: config.model } : {}),
  };
}

/** Extract the plain-text concatenation of a content block list. */
export function textOf(blocks: ContentBlock[] | undefined): string {
  if (!Array.isArray(blocks)) return "";
  let out = "";
  for (const block of blocks) {
    if (block && block.type === "text" && typeof (block as TextBlock).text === "string") {
      out += (block as TextBlock).text;
    }
  }
  return out;
}

/**
 * Parse a raw session.jsonl payload, expanding packed chunk rows back into
 * `assistant/chunk` events (the inverse of the storage encoding). The first
 * line may be the `{"type":"session", ...}` header record.
 *
 * Packed row shapes (packages/core/session/src/chunk-rows.ts):
 *   {"type":"reasoning-chunks","seq0":N,"time0":T,
 *    "data":{"turn","step","index","dt":[ms...],"texts":[str...]}}
 * `dt[i]` is the delta from `time0` to chunk i's time; `text-chunks` carries
 * text deltas; `tool-call-chunks` additionally carries id/name and per-delta
 * argument fragments in `args`.
 */
export function parseSessionJsonl(text: string): ParsedSessionLog {
  const events: SessionEvent[] = [];
  let header: SessionHeader | null = null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue; // tolerate a torn tail line
    }
    if (row.type === "session" && typeof row.id === "string") {
      header = {
        id: row.id,
        version: typeof row.version === "number" ? row.version : 0,
        createdAt: typeof row.createdAt === "number" ? row.createdAt : 0,
        ...(typeof row.cwd === "string" ? { cwd: row.cwd } : {}),
      };
      continue;
    }
    if (
      (row.type === "text-chunks" || row.type === "reasoning-chunks" || row.type === "tool-call-chunks") &&
      typeof row.seq0 === "number" &&
      typeof row.time0 === "number"
    ) {
      events.push(...expandPackedRow(row));
      continue;
    }
    if (typeof row.type === "string" && typeof row.seq === "number" && typeof row.time === "number") {
      events.push(row as unknown as SessionEvent);
    }
  }
  return { header, events };
}

function expandPackedRow(row: Record<string, unknown>): SessionEvent[] {
  const data = asRecord(row.data) ?? {};
  const turn = typeof data.turn === "number" ? data.turn : 0;
  const step = typeof data.step === "number" ? data.step : 0;
  const index = typeof data.index === "number" ? data.index : 0;
  const dt = Array.isArray(data.dt) ? (data.dt as number[]) : [];
  const seq0 = row.seq0 as number;
  const time0 = row.time0 as number;
  const out: SessionEvent[] = [];

  if (row.type === "tool-call-chunks") {
    const args = Array.isArray(data.args) ? (data.args as string[]) : [];
    const id = typeof data.id === "string" ? data.id : undefined;
    const name = typeof data.name === "string" ? data.name : undefined;
    for (let i = 0; i < args.length; i++) {
      out.push({
        type: "assistant/chunk",
        seq: seq0 + i,
        time: time0 + (typeof dt[i] === "number" ? (dt[i] as number) : 0),
        data: {
          turn,
          step,
          chunk: {
            type: "tool-call-delta",
            index,
            ...(i === 0 && id !== undefined ? { id } : {}),
            ...(i === 0 && name !== undefined ? { name } : {}),
            argumentsDelta: args[i] ?? "",
          },
        },
      });
    }
    return out;
  }

  const texts = Array.isArray(data.texts) ? (data.texts as string[]) : [];
  const chunkType = row.type === "reasoning-chunks" ? "reasoning-delta" : "text-delta";
  for (let i = 0; i < texts.length; i++) {
    out.push({
      type: "assistant/chunk",
      seq: seq0 + i,
      time: time0 + (typeof dt[i] === "number" ? (dt[i] as number) : 0),
      data: { turn, step, chunk: { type: chunkType, index, text: texts[i] ?? "" } },
    });
  }
  return out;
}
