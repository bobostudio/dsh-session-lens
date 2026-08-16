import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeSession, formatDuration, formatTokens } from "../src/analytics.ts";
import { parseSessionJsonl, type SessionEvent } from "../src/events.ts";

const fixtureText = readFileSync(new URL("./fixtures/sample.session.jsonl", import.meta.url), "utf8");
const { header, events } = parseSessionJsonl(fixtureText);
const analytics = analyzeSession(events, header);

test("parser: header + packed row expansion", () => {
  assert.equal(header?.id, "test-session-001");
  assert.equal(header?.cwd, "D:\\work\\proj");
  // 28 event lines; one reasoning-chunks row expands into 2 events → 29.
  assert.equal(events.length, 29);
  const expanded = events.filter((e) => e.type === "assistant/chunk");
  assert.equal(expanded.length, 3); // 1 literal block-start + 2 expanded deltas
  const delta = expanded.find((e) => e.seq === 7);
  assert.deepEqual((delta?.data as { chunk: { type: string; text: string } }).chunk, {
    type: "reasoning-delta",
    text: "要创建文件。",
    index: 0,
  });
});

test("overview: title, models, status, counts", () => {
  assert.equal(analytics.sessionId, "test-session-001");
  assert.equal(analytics.title, "新建并运行 hello.ts");
  assert.equal(analytics.status, "completed");
  assert.deepEqual(analytics.providers, ["deepseek-official"]);
  assert.deepEqual(analytics.models, ["deepseek-v4-flash"]);
  assert.equal(analytics.turns, 2);
  assert.equal(analytics.userMessages, 2);
  assert.equal(analytics.assistantMessages, 3);
  assert.equal(analytics.reasoningChars, "用户要创建文件。".length);
  assert.equal(analytics.durationMs, 1784973870200 - 1784973850100);
});

test("tokens: assistant/message usage summed, compaction kept separate", () => {
  assert.deepEqual(analytics.tokens, {
    input: 3800,
    output: 220,
    cacheRead: 14500,
    cacheWrite: 500,
    reasoning: 45,
    total: 19020,
  });
  assert.deepEqual(analytics.compactionTokens, {
    input: 3000,
    output: 200,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    total: 3200,
  });
  // Streaming chunk usage must NOT double-count (fixture has none, but the
  // totals above would break if chunks leaked into the sum).
});

test("per-turn rows: duration, tokens, tool counts", () => {
  assert.equal(analytics.perTurn.length, 2);
  const [t1, t2] = analytics.perTurn;
  assert.equal(t1?.turn, 1);
  assert.equal(t1?.durationMs, 1720);
  assert.equal(t1?.input, 1800);
  assert.equal(t1?.output, 160);
  assert.equal(t1?.cacheRead, 8500);
  assert.equal(t1?.cacheWrite, 500);
  assert.equal(t1?.reasoning, 40);
  assert.equal(t1?.toolCalls, 1);
  assert.equal(t1?.toolErrors, 0);
  assert.equal(t1?.userMessages, 1);
  assert.equal(t1?.assistantMessages, 2);
  assert.equal(t1?.endReason, "completed");
  assert.equal(t2?.turn, 2);
  assert.equal(t2?.durationMs, 10200);
  assert.equal(t2?.toolCalls, 1);
  assert.equal(t2?.toolErrors, 1);
});

test("tools: pairing by callId, error flag, durations", () => {
  assert.equal(analytics.tools.length, 2);
  const write = analytics.tools.find((t) => t.name === "write");
  const bash = analytics.tools.find((t) => t.name === "bash");
  assert.deepEqual(write, { name: "write", calls: 1, errors: 0, totalDurationMs: 100, maxDurationMs: 100 });
  assert.deepEqual(bash, { name: "bash", calls: 1, errors: 1, totalDurationMs: 3000, maxDurationMs: 3000 });
});

test("activity: compaction/approval/subagent/retry counters", () => {
  assert.deepEqual(analytics.activity, {
    compactions: 1,
    compactionShadowedTokens: 9000,
    approvalsAsked: 1,
    approvalsApproved: 1,
    approvalsDenied: 0,
    subagents: 1,
    llmRetries: 1,
    planModeToggles: 0,
    todosWritten: 0,
    feedbackRecords: 0,
  });
});

test("per-model breakdown", () => {
  assert.equal(analytics.perModel.length, 1);
  assert.equal(analytics.perModel[0]?.model, "deepseek-v4-flash");
  assert.equal(analytics.perModel[0]?.calls, 3);
  assert.equal(analytics.perModel[0]?.tokens.total, 19020);
});

test("edge cases: empty + active session", () => {
  const empty = analyzeSession([], null, "x");
  assert.equal(empty.turns, 0);
  assert.equal(empty.status, "active");
  assert.equal(empty.durationMs, null);
  assert.equal(empty.tokens.total, 0);

  const open: SessionEvent[] = [
    { type: "turn/start", seq: 0, time: 1000, data: { turn: 1 } },
  ];
  const active = analyzeSession(open, null);
  assert.equal(active.status, "active");
  assert.equal(active.perTurn[0]?.endedAt, null);
});

test("formatters", () => {
  assert.equal(formatTokens(999), "999");
  assert.equal(formatTokens(1500), "1.50k");
  assert.equal(formatTokens(12300), "12.3k");
  assert.equal(formatTokens(2_500_000), "2.5M");
  assert.equal(formatDuration(null), "—");
  assert.equal(formatDuration(83_000), "1:23");
  assert.equal(formatDuration(3_723_000), "1:02:03");
});
