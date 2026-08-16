import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSessionJsonl, type ToolCallData, type ToolResultData, type UserMessageData } from "../src/events.ts";
import {
  collectAllVariants,
  collectPathVariants,
  filterStoryEvents,
  maskText,
  redactEvent,
  redactEvents,
  STORY_EVENT_TYPES,
} from "../src/redact.ts";

const fixtureText = readFileSync(new URL("./fixtures/sample.session.jsonl", import.meta.url), "utf8");
const { header, events } = parseSessionJsonl(fixtureText);
const cwd = header?.cwd ?? null;

test("story whitelist drops internal plumbing (system prompt can never leak)", () => {
  const story = filterStoryEvents(events);
  assert.equal(story.length, 18);
  assert.ok(!story.some((e) => e.type === "request/header"));
  assert.ok(!story.some((e) => e.type === "assistant/chunk"));
  assert.ok(!story.some((e) => e.type === "llm/retry-started"));
  assert.ok(!story.some((e) => e.type === "step/start" || e.type === "step/end"));
  const serialized = JSON.stringify(story);
  assert.ok(!serialized.includes("SECRET-SYSTEM-PROMPT"));
  assert.ok(!serialized.includes("SECRET-TOOLS-LIST"));
  // Every story event type is whitelisted.
  for (const e of story) assert.ok(STORY_EVENT_TYPES.has(e.type), e.type);
});

test("path variants cover slash flipping and drive-letter case", () => {
  const variants = collectPathVariants("D:\\work\\proj");
  assert.ok(variants.includes("D:\\work\\proj"));
  assert.ok(variants.includes("D:/work/proj"));
  assert.ok(variants.includes("d:\\work\\proj"));
  assert.equal(collectPathVariants(null).length, 0);
  assert.equal(collectPathVariants("C:").length, 0); // too short to be safe
});

test("maskText replaces every variant with ~", () => {
  assert.equal(
    maskText("see D:\\work\\proj\\src and D:/work/proj/dist", collectPathVariants("D:\\work\\proj")),
    "see ~\\src and ~/dist",
  );
});

test("collectAllVariants merges several base paths, dedupes, longest-first", () => {
  const variants = collectAllVariants(["D:\\work\\proj", "C:\\Users\\tester"]);
  assert.ok(variants.includes("D:/work/proj"));
  assert.ok(variants.includes("C:\\Users\\tester"));
  assert.ok(variants.includes("C:\\\\Users\\\\tester")); // JSON-escaped form
  for (let i = 1; i < variants.length; i++) {
    assert.ok(variants[i - 1]!.length >= variants[i]!.length, "sorted longest-first");
  }
});

test("extraPaths masks home-dir payloads (result text and escaped arguments)", () => {
  const result = {
    type: "tool/result",
    seq: 1,
    time: 1,
    data: { content: [{ type: "text", text: "cache at C:\\Users\\tester\\AppData\\Local\\npm-cache" }] },
  };
  const redacted = redactEvent(result as never, { cwd: "D:\\work\\proj", extraPaths: ["C:\\Users\\tester"] });
  const text = ((redacted.data as { content: { text: string }[] }).content[0]!).text;
  assert.equal(text, "cache at ~\\AppData\\Local\\npm-cache");

  // JSON-escaped home path inside unparsed tool-call arguments.
  const call = {
    type: "tool/call",
    seq: 2,
    time: 2,
    data: { name: "read", arguments: '{"path": "C:\\\\Users\\\\tester\\\\.dsh\\\\config.json"}' },
  };
  const redactedCall = redactEvent(call as never, { cwd: null, extraPaths: ["C:\\Users\\tester"] });
  const args = (redactedCall.data as { arguments: string }).arguments;
  assert.ok(!args.includes("C:\\\\Users"), args);
  assert.ok(args.includes("~\\\\.dsh"), args);
});

test("mask=off leaves extra paths untouched", () => {
  const result = {
    type: "tool/result",
    seq: 1,
    time: 1,
    data: { content: [{ type: "text", text: "at C:\\Users\\tester\\x" }] },
  };
  const redacted = redactEvent(result as never, { maskPaths: false, extraPaths: ["C:\\Users\\tester"] });
  assert.ok(
    ((redacted.data as { content: { text: string }[] }).content[0]!).text.includes("C:\\Users\\tester"),
  );
});

test("tool call arguments are path-masked (JSON-escaped form too)", () => {
  const call = events.find((e) => e.type === "tool/call")!;
  const redacted = redactEvent(call, { cwd });
  const data = redacted.data as ToolCallData;
  // arguments is an UNPARSED JSON string: the path appears with doubled
  // backslashes and must still be masked.
  assert.ok(!data.arguments.includes("D:\\\\work\\\\proj"), data.arguments);
  assert.ok(!data.arguments.includes("D:\\work\\proj"), data.arguments);
  assert.ok(data.arguments.includes("~\\\\src\\\\hello.ts"), data.arguments);
  // Original event untouched.
  assert.ok((call.data as ToolCallData).arguments.includes("D:\\\\work\\\\proj"));
});

test("tool result truncation with marker; full mode keeps text", () => {
  const result = events.find((e) => e.type === "tool/result" && e.seq === 24)!;
  const truncated = redactEvent(result, { cwd, maxTextLength: 20 });
  const data = truncated.data as ToolResultData;
  const text = (data.content?.[0] as { text: string }).text;
  assert.equal(text, "LONG-OUTPUT-START PL\n…[+25 chars]");
  const full = redactEvent(result, { cwd, maxTextLength: null });
  assert.equal(
    ((full.data as ToolResultData).content?.[0] as { text: string }).text,
    "LONG-OUTPUT-START PLACEHOLDER LONG-OUTPUT-END",
  );
});

test("image blocks become placeholders", () => {
  const msg = events.find((e) => e.type === "user/message" && e.seq === 17)!;
  const redacted = redactEvent(msg, { cwd });
  const content = (redacted.data as UserMessageData).content;
  assert.equal(content.length, 2);
  assert.equal(content[1]?.type, "text");
  assert.match((content[1] as { text: string }).text, /图片未导出/);
});

test("message text is path-masked but not truncated", () => {
  const msg = events.find((e) => e.type === "assistant/message" && e.seq === 13)!;
  const redacted = redactEvent(msg, { cwd, maxTextLength: 3 });
  const data = redacted.data as { content: { type: string; text: string }[] };
  const textBlock = data.content.find((b) => b.type === "text");
  assert.equal(textBlock?.text, "已创建 ~\\src\\hello.ts。");
});

test("redactEvents composes with the story filter for a leak-free export set", () => {
  const exportSet = redactEvents(filterStoryEvents(events), { cwd });
  const serialized = JSON.stringify(exportSet);
  assert.ok(!serialized.includes("SECRET-SYSTEM-PROMPT"));
  assert.ok(!serialized.includes("D:\\work\\proj"));
  assert.ok(!serialized.includes("D:/work/proj"));
  assert.ok(!serialized.includes("sha256:deadbeef"));
});
