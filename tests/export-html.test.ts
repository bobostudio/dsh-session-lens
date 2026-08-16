import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { analyzeSession } from "../src/analytics.ts";
import { parseSessionJsonl } from "../src/events.ts";
import { esc, renderSessionHtml } from "../src/export-html.ts";

const fixtureText = readFileSync(new URL("./fixtures/sample.session.jsonl", import.meta.url), "utf8");
const { header, events } = parseSessionJsonl(fixtureText);
const analytics = analyzeSession(events, header);

const html = renderSessionHtml(events, analytics, header, { cwd: header?.cwd });

test("document skeleton: lang, charset, CSP, title, no external resources", () => {
  assert.ok(html.startsWith("<!doctype html>"));
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.ok(!html.includes("http://") || html.includes("github.com/bobostudio"), "no insecure external refs");
  assert.ok(!html.includes("<script"), "export contains zero JavaScript");
  assert.match(html, /<title>新建并运行 hello\.ts · 会话洞察报告<\/title>/);
});

test("stats section renders real numbers", () => {
  assert.match(html, />19\.0k</); // total tokens chip
  assert.match(html, /14\.5k/); // cache read
  assert.match(html, /token-bar/); // svg bar
  assert.match(html, /<td>#1<\/td>/); // turn rows
  assert.match(html, /<td>#2<\/td>/);
  assert.match(html, /<code>write<\/code>/);
  assert.match(html, /<code>bash<\/code>/);
  assert.match(html, /<td>0:10<\/td>/); // turn 2 duration 10200ms
});

test("replay renders messages, tools, markers", () => {
  assert.match(html, /帮我在 ~\\src 下新建 hello\.ts/); // path masked in user msg
  assert.match(html, /思维链/); // reasoning details
  assert.match(html, /⚙ write/);
  assert.match(html, /🛡 请求审批/);
  assert.match(html, /✅ 已批准/);
  assert.match(html, /🗜 上下文压缩/);
  assert.match(html, /🐳 子 Agent/);
  assert.match(html, /图片未导出/);
});

test("privacy: no system prompt, no raw paths, no attachment refs anywhere", () => {
  assert.ok(!html.includes("SECRET-SYSTEM-PROMPT"));
  assert.ok(!html.includes("SECRET-TOOLS-LIST"));
  assert.ok(!html.includes("D:\\work\\proj"), "single-backslash form");
  assert.ok(!html.includes("D:\\\\work\\\\proj"), "JSON-escaped double-backslash form (assistant tool-call args)");
  assert.ok(!html.includes("D:/work/proj"));
  assert.ok(!html.includes("sha256:deadbeef"));
  assert.ok(!html.includes("rate-limit"), "llm/retry internals are not story events");
});

test("extraPaths (home dir) are masked end-to-end in the export", () => {
  const ev = [
    {
      type: "tool/result",
      seq: 1,
      time: 1,
      data: { content: [{ type: "text", text: "installed under C:\\Users\\tester\\npm-cache" }] },
    },
  ] as never[];
  const out = renderSessionHtml(ev, undefined, undefined, { extraPaths: ["C:\\Users\\tester"] });
  assert.ok(!out.includes("C:\\Users\\tester"), "home prefix masked");
  assert.match(out, /~\\npm-cache/);
});

test("english chrome", () => {
  const en = renderSessionHtml(events, analytics, header, { cwd: header?.cwd, lang: "en" });
  assert.match(en, /<html lang="en">/);
  assert.match(en, /Session Insights Report/);
  assert.match(en, /Per-turn breakdown/);
});

test("esc covers the five dangerous chars", () => {
  assert.equal(esc(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
});

test("write example export for docs/", () => {
  mkdirSync(new URL("../docs/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../docs/example.html", import.meta.url), html, "utf8");
  const en = renderSessionHtml(events, analytics, header, { cwd: header?.cwd, lang: "en" });
  writeFileSync(new URL("../docs/example.en.html", import.meta.url), en, "utf8");
  assert.ok(html.length > 5000);
});
