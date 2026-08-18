// @ts-nocheck — runtime smoke test against the BUILT bundle (no type
// declarations); mock Cordis/webServer objects are intentionally duck-typed.
/**
 * Server-half integration smoke test: mount the BUILT plugin (lib/index.js)
 * against a mock Cordis context + web server, then exercise both routes the
 * way the DSH web server would. Covers the loopback fence, id validation,
 * live/persisted data paths, and the export download.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSessionJsonl } from "../src/events.ts";

interface PluginModule {
  apply: (ctx: unknown) => void;
  inject: string[];
  name: string;
}
// The built bundle ships no type declarations; assert its runtime shape.
const { apply, inject, name } = (await import("../lib/index.js")) as unknown as PluginModule;

const { header, events } = parseSessionJsonl(
  readFileSync(new URL("./fixtures/sample.session.jsonl", import.meta.url), "utf8"),
);

function mockRes() {
  return {
    status: 0,
    headers: {} as Record<string, string>,
    body: "",
    writeHead(status: number, headers?: Record<string, string>) {
      this.status = status;
      this.headers = headers ?? {};
    },
    end(chunk?: string) {
      this.body = chunk ?? "";
    },
  };
}

function mockReq(url, { method = "GET", remoteAddress = "127.0.0.1", host = "localhost:3000" } = {}) {
  return { method, url, socket: { remoteAddress }, headers: { host } };
}

function mount(overrides = {}) {
  const routes = new Map();
  const ctx = {
    get(service) {
      return overrides[service];
    },
    effect(fn) {
      this._disposers.push(fn());
    },
    webServer: {
      register(spec) {
        routes.set(spec.path, spec.handler);
        return () => routes.delete(spec.path);
      },
    },
    logger: { warn() {} },
    _disposers: [],
  };
  apply(ctx);
  return { ctx, routes };
}

const liveSessions = {
  list: () => [
    { id: "test-session-001", events, cwd: header?.cwd, createdAt: header?.createdAt },
  ],
};

const persistence = {
  list: async () => [{ id: "persisted-002", cwd: header?.cwd, createdAt: header?.createdAt }],
  readFrom: async (id) => {
    if (id !== "persisted-002") throw new Error("not found");
    return { events, header: { ...header, id } };
  },
};

test("plugin manifest shape", () => {
  assert.equal(name, "session-lens");
  assert.deepEqual(inject, ["webServer"]);
});

test("analytics route: live session via sessions service", async () => {
  const { routes } = mount({ sessions: liveSessions });
  const res = mockRes();
  await routes.get("/api/session-lens/analytics")(mockReq("/api/session-lens/analytics?sessionId=test-session-001"), res);
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.live, true);
  assert.equal(body.analytics.title, "新建并运行 hello.ts");
  assert.equal(body.analytics.tokens.total, 19020);
  assert.equal(body.analytics.turns, 2);
});

test("analytics route: persisted session fallback via sessionPersistence", async () => {
  const { routes } = mount({ sessions: { list: () => [] }, sessionPersistence: persistence });
  const res = mockRes();
  await routes.get("/api/session-lens/analytics")(mockReq("/api/session-lens/analytics?sessionId=persisted-002"), res);
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.live, false);
  assert.equal(body.analytics.sessionId, "persisted-002");
});

test("fence: non-loopback peer is refused even with loopback Host header", async () => {
  const { routes } = mount({ sessions: liveSessions });
  const res = mockRes();
  await routes.get("/api/session-lens/analytics")(
    mockReq("/api/session-lens/analytics?sessionId=test-session-001", { remoteAddress: "10.0.0.5" }),
    res,
  );
  assert.equal(res.status, 403);
});

test("fence: non-GET method and hostile Host are refused", async () => {
  const { routes } = mount({ sessions: liveSessions });
  const post = mockRes();
  await routes.get("/api/session-lens/analytics")(
    mockReq("/api/session-lens/analytics?sessionId=test-session-001", { method: "POST" }),
    post,
  );
  assert.equal(post.status, 405);
  const dnsRebind = mockRes();
  await routes.get("/api/session-lens/analytics")(
    mockReq("/api/session-lens/analytics?sessionId=test-session-001", { host: "evil.example.com" }),
    dnsRebind,
  );
  assert.equal(dnsRebind.status, 403);
});

test("validation: bad session id rejected before any data access", async () => {
  let touched = false;
  const { routes } = mount({
    sessions: {
      list: () => {
        touched = true;
        return [];
      },
    },
  });
  const res = mockRes();
  await routes.get("/api/session-lens/analytics")(mockReq("/api/session-lens/analytics?sessionId=../../etc"), res);
  assert.equal(res.status, 400);
  assert.equal(touched, false);
});

test("404 for unknown session", async () => {
  const { routes } = mount({ sessions: { list: () => [] }, sessionPersistence: persistence });
  const res = mockRes();
  await routes.get("/api/session-lens/analytics")(mockReq("/api/session-lens/analytics?sessionId=nope-123"), res);
  assert.equal(res.status, 404);
});

test("export route: attachment download, redacted, language switch, theme", async () => {
  const { routes } = mount({ sessions: liveSessions });
  const res = mockRes();
  await routes.get("/api/session-lens/export")(
    mockReq("/api/session-lens/export?sessionId=test-session-001&lang=en&full=1&mask=1&theme=dark"),
    res,
  );
  assert.equal(res.status, 200);
  assert.match(res.headers["content-type"], /text\/html/);
  assert.match(res.headers["content-disposition"], /attachment; filename="dsh-session-test-ses\.html"/);
  assert.match(res.body, /Session Insights Report/);
  assert.match(res.body, /:root\{color-scheme:dark\}/);
  assert.match(res.body, /body\{background:#14161a/);
  assert.ok(!res.body.includes("SECRET-SYSTEM-PROMPT"));
  // full=1 keeps tool output, mask=1 still masks paths.
  assert.ok(res.body.includes("LONG-OUTPUT-START PLACEHOLDER LONG-OUTPUT-END"));
  assert.ok(!res.body.includes("D:\\work\\proj"));
});

test("plugin survives missing optional services (headless degradation)", async () => {
  const { routes } = mount({});
  const res = mockRes();
  await routes.get("/api/session-lens/analytics")(mockReq("/api/session-lens/analytics?sessionId=test-session-001"), res);
  assert.equal(res.status, 404); // no crash, clean not-found
});
