/**
 * dsh-session-lens — Node half.
 *
 * Registers two read-only, loopback-fenced endpoints on the DSH web server
 * (exact routes under /api so they win over the connection plugin's prefix
 * handler, same pattern as other community plugins):
 *
 *   GET /api/session-lens/analytics?sessionId=<id>
 *       Aggregate model for the Lens view tab.
 *
 *   GET /api/session-lens/export?sessionId=<id>&lang=zh|en&full=0|1&mask=0|1
 *       Self-contained, redacted HTML replay (Content-Disposition download).
 *
 * Session events are read through the harness's own services — the live
 * `sessions` service for attached sessions, `sessionPersistence` for
 * persisted ones — both consumed OPTIONALLY via ctx.get so the plugin
 * degrades instead of failing when a service moves. Nothing is written to
 * disk by this plugin.
 *
 * @module dsh-session-lens
 */

import { homedir } from "node:os";
import { analyzeSession } from "./analytics.ts";
import { renderSessionHtml } from "./export-html.ts";
import type { SessionEvent, SessionHeader } from "./events.ts";

/** Stable Cordis plugin name. */
const name = "session-lens";

/** Only the web server is required; data services are optional (ctx.get). */
const inject = ["webServer"];

const ANALYTICS_PATH = "/api/session-lens/analytics";
const EXPORT_PATH = "/api/session-lens/export";
const SESSION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/** Write a JSON response. */
function json(res: any, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-cache",
  });
  res.end(body);
}

/** Normalize IPv4-mapped IPv6 and check for a loopback peer address. */
function isLoopbackAddress(address: unknown): boolean {
  if (typeof address !== "string") return false;
  const a = address.toLowerCase();
  if (a === "::1") return true;
  const ipv4 = a.startsWith("::ffff:") ? a.slice(7) : a;
  const octets = ipv4.split(".");
  return (
    octets.length === 4 &&
    octets[0] === "127" &&
    octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  );
}

/** Parse a Host header without breaking bracketed or bare IPv6 literals. */
function hostNameOf(value: unknown): string | null {
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

/**
 * Fence: GET-only + loopback peer socket (the deciding check, since Host is
 * client-controllable) + loopback Host (defense in depth).
 */
function rejectForeignCaller(req: any, res: any): boolean {
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

interface LoadedSession {
  events: SessionEvent[];
  header: SessionHeader | null;
  live: boolean;
}

/** Duck-typed live session record from the `sessions` service. */
interface LiveSession {
  id: string;
  events?: SessionEvent[];
  cwd?: string;
  createdAt?: number;
}

interface LiveSessionsService {
  list(): LiveSession[];
}

interface PersistenceService {
  list?: () => Promise<Array<{ id: string; cwd?: string; createdAt?: number }>>;
  readFrom: (id: string, fromSeq: number) => Promise<{ events: SessionEvent[]; header?: SessionHeader }>;
}

/**
 * Load one session's full expanded event stream. Live sessions come from the
 * `sessions` service's in-memory log; otherwise fall back to the persistence
 * backend. Returns null when the id is unknown to both.
 */
async function loadSession(ctx: any, sessionId: string): Promise<LoadedSession | null> {
  const sessions = ctx.get("sessions") as LiveSessionsService | undefined;
  if (sessions !== undefined && typeof sessions.list === "function") {
    try {
      const live = sessions.list().find((entry) => entry.id === sessionId);
      if (live !== undefined && Array.isArray(live.events)) {
        const header: SessionHeader = {
          id: sessionId,
          version: 0,
          createdAt: typeof live.createdAt === "number" ? live.createdAt : (live.events[0]?.time ?? 0),
          ...(typeof live.cwd === "string" ? { cwd: live.cwd } : {}),
        };
        return { events: live.events, header, live: true };
      }
    } catch (error) {
      ctx.logger?.warn?.(`session-lens: live session lookup failed: ${String(error)}`);
    }
  }

  const persistence = ctx.get("sessionPersistence") as PersistenceService | undefined;
  if (persistence !== undefined && typeof persistence.readFrom === "function") {
    try {
      const result = await persistence.readFrom(sessionId, 0);
      if (Array.isArray(result?.events)) {
        let header: SessionHeader | null = result.header ?? null;
        if (header === null && typeof persistence.list === "function") {
          try {
            const metas = await persistence.list();
            const meta = metas.find((entry) => entry.id === sessionId);
            if (meta !== undefined) {
              header = {
                id: sessionId,
                version: 0,
                createdAt: typeof meta.createdAt === "number" ? meta.createdAt : (result.events[0]?.time ?? 0),
                ...(typeof meta.cwd === "string" ? { cwd: meta.cwd } : {}),
              };
            }
          } catch {
            /* meta lookup is best-effort */
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

function sessionIdFrom(req: any): string | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  const id = url.searchParams.get("sessionId") ?? "";
  return SESSION_ID_PATTERN.test(id) ? id : null;
}

async function handleAnalytics(ctx: any, req: any, res: any): Promise<void> {
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

async function handleExport(ctx: any, req: any, res: any): Promise<void> {
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
  try {
    const loaded = await loadSession(ctx, sessionId);
    if (loaded === null) {
      json(res, 404, { ok: false, error: "session-not-found", sessionId });
      return;
    }
    const html = renderSessionHtml(loaded.events, undefined, loaded.header, {
      cwd: loaded.header?.cwd ?? null,
      // Tool payloads routinely embed install/cache paths under the user's
      // home (npm-cache, ~/.dsh/…) — mask those to `~` alongside the cwd.
      extraPaths: [homedir()],
      lang,
      maskPaths: mask,
      maxTextLength: full ? null : 2000,
    });
    const filename = `dsh-session-${sessionId.slice(0, 8)}.html`;
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-cache",
    });
    res.end(html);
  } catch (error) {
    ctx.logger?.warn?.(`session-lens: export failed: ${String(error)}`);
    json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Plugin body: register the two exact routes. Both registrations ride
 * ctx.effect so unload removes them cleanly.
 */
function apply(ctx: any): void {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: ANALYTICS_PATH,
        handler: (req: any, res: any) => handleAnalytics(ctx, req, res),
      }),
    "session-lens: analytics route",
  );
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: EXPORT_PATH,
        handler: (req: any, res: any) => handleExport(ctx, req, res),
      }),
    "session-lens: export route",
  );
}

export { apply, inject, name, ANALYTICS_PATH, EXPORT_PATH };
