/**
 * Regression tests for the rc.6 npm-build log shapes (ground truth from a
 * real ~/.dsh session): assistant content/provenance nested under
 * `data.message`, tool/result payload nested under `data.message` with
 * tool-result wrapper blocks, and NO provenance anywhere (provider/model
 * only on request/context).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeSession } from "../src/analytics.ts";
import { parseSessionJsonl } from "../src/events.ts";
import { renderSessionHtml } from "../src/export-html.ts";

const { header, events } = parseSessionJsonl(
  readFileSync(new URL("./fixtures/rc6.session.jsonl", import.meta.url), "utf8"),
);
const analytics = analyzeSession(events, header);

test("rc6: provider/model recovered from request/context (no provenance in log)", () => {
  assert.deepEqual(analytics.providers, ["deepseek-official"]);
  assert.deepEqual(analytics.models, ["deepseek-v4-flash"]);
});

test("rc6: nested assistant content + top-level usage aggregated", () => {
  assert.equal(analytics.assistantMessages, 2);
  assert.equal(analytics.reasoningChars, "先加载技能再检查 Slot。".length);
  assert.deepEqual(analytics.tokens, {
    input: 2100,
    output: 380,
    cacheRead: 16100,
    cacheWrite: 0,
    reasoning: 42,
    total: 18580,
  });
});

test("rc6: nested tool/result pairs by message.source.callId with duration", () => {
  assert.equal(analytics.tools.length, 1);
  assert.deepEqual(analytics.tools[0], {
    name: "skill",
    calls: 1,
    errors: 0,
    totalDurationMs: 21,
    maxDurationMs: 21,
  });
  assert.ok(!analytics.tools.some((t) => t.name === "unknown"));
});

test("rc6: export renders nested shapes and keeps secrets out", () => {
  const html = renderSessionHtml(events, analytics, header, { cwd: header?.cwd });
  assert.match(html, /先加载技能再检查 Slot。/); // nested reasoning rendered
  assert.match(html, /技能内容来自/); // nested tool-result text rendered
  assert.match(html, /已完成：按钮已换成狗头。/);
  assert.ok(!html.includes("RC6-SYSTEM-SECRET"));
  assert.ok(!html.includes("C:\\Users\\tester\\proj"), "nested result text is path-masked");
  assert.ok(!html.includes("C:/Users/tester/proj"));
  assert.match(html, /deepseek-v4-flash/); // model shown in header meta
});
