import { useCallback, useEffect, useState } from "react";
import {
  formatDuration,
  formatTokens,
  type SessionAnalytics,
  type TokenTotals,
} from "../analytics.ts";
import { NS, type LensKey } from "./locales.ts";
import { ensureLensStyles } from "./styles.ts";
import type { ExportTheme } from "../export-html.ts";

export interface LensViewProps {
  sessionId: string;
  t: (key: LensKey) => string;
}

type Translate = (key: LensKey) => string;

interface LoadedData {
  analytics: SessionAnalytics;
  live: boolean;
}

interface ExportOpts {
  full: boolean;
  mask: boolean;
  lang: "zh" | "en";
  theme: ExportTheme;
}

const OPTS_KEY = "dsh-session-lens:export-opts";

function loadOpts(): ExportOpts {
  try {
    const raw = globalThis.localStorage?.getItem(OPTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ExportOpts>;
      return {
        full: parsed.full === true,
        mask: parsed.mask !== false,
        lang: parsed.lang === "en" ? "en" : "zh",
        theme: parsed.theme === "system" || parsed.theme === "light" ? parsed.theme : "dark",
      };
    }
  } catch {
    /* fall through to defaults */
  }
  return { full: false, mask: true, lang: "zh", theme: "dark" };
}

function saveOpts(opts: ExportOpts): void {
  try {
    globalThis.localStorage?.setItem(OPTS_KEY, JSON.stringify(opts));
  } catch {
    /* non-fatal */
  }
}

const TOKEN_SEGMENTS: Array<{ key: keyof TokenTotals & string; labelKey: LensKey; color: string }> = [
  { key: "input", labelKey: "stats.input", color: "#4c8dff" },
  { key: "output", labelKey: "stats.output", color: "#34c98e" },
  { key: "cacheRead", labelKey: "stats.cacheRead", color: "#8b7cf6" },
  { key: "cacheWrite", labelKey: "stats.cacheWrite", color: "#c9a0f6" },
  { key: "reasoning", labelKey: "stats.reasoning", color: "#f6a35c" },
];

function TokenBar({ tokens, t }: { tokens: TokenTotals; t: Translate }) {
  const segments = TOKEN_SEGMENTS.map((seg) => ({
    ...seg,
    value: tokens[seg.key] as number,
  })).filter((seg) => seg.value > 0);
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  if (total === 0) return null;
  const width = 720;
  let x = 0;
  const rects = segments.map((seg) => {
    const w = Math.max(2, Math.round((seg.value / total) * width));
    const rect = (
      <rect key={seg.key} x={x} y={0} width={Math.min(w, width - x)} height={22} fill={seg.color}>
        <title>{`${t(seg.labelKey)} ${formatTokens(seg.value)}`}</title>
      </rect>
    );
    x += w;
    return rect;
  });
  return (
    <>
      <svg viewBox={`0 0 ${width} 22`} className="lens-bar" role="img">
        {rects}
      </svg>
      <div className="lens-legend">
        {segments.map((seg) => (
          <span key={seg.key}>
            <span className="lens-dot" style={{ background: seg.color }} />
            {t(seg.labelKey)} {formatTokens(seg.value)}
          </span>
        ))}
      </div>
    </>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="lens-chip">
      <div className="lens-chip-value">{value}</div>
      <div className="lens-chip-label">{label}</div>
    </div>
  );
}

function AnalyticsView({ analytics, t }: { analytics: SessionAnalytics; t: Translate }) {
  const act = analytics.activity;
  return (
    <>
      <div className="lens-chips">
        <Chip label={t("stats.total")} value={formatTokens(analytics.tokens.total)} />
        <Chip label={t("stats.input")} value={formatTokens(analytics.tokens.input)} />
        <Chip label={t("stats.output")} value={formatTokens(analytics.tokens.output)} />
        <Chip label={t("stats.cacheRead")} value={formatTokens(analytics.tokens.cacheRead)} />
        {analytics.tokens.cacheWrite > 0 && (
          <Chip label={t("stats.cacheWrite")} value={formatTokens(analytics.tokens.cacheWrite)} />
        )}
        <Chip label={t("stats.reasoning")} value={formatTokens(analytics.tokens.reasoning)} />
        {analytics.compactionTokens !== null && (
          <Chip label={t("stats.compaction")} value={formatTokens(analytics.compactionTokens.total)} />
        )}
        <Chip label={t("overview.turns")} value={String(analytics.turns)} />
        <Chip label={t("stats.duration")} value={formatDuration(analytics.durationMs)} />
      </div>

      <div className="lens-section">
        <h3>{t("stats.tokens")}</h3>
        <TokenBar tokens={analytics.tokens} t={t} />
      </div>

      {analytics.perTurn.length > 0 && (
        <div className="lens-section">
          <h3>{t("stats.perTurn")}</h3>
          <table className="lens-table">
            <thead>
              <tr>
                <th>{t("stats.turn")}</th>
                <th>{t("stats.duration")}</th>
                <th>{t("stats.input")}+Cache</th>
                <th>{t("stats.output")}</th>
                <th>{t("stats.reasoning")}</th>
                <th>{t("stats.toolCalls")}</th>
              </tr>
            </thead>
            <tbody>
              {analytics.perTurn.map((turn) => (
                <tr key={turn.turn}>
                  <td>#{turn.turn}</td>
                  <td>{formatDuration(turn.durationMs)}</td>
                  <td>{formatTokens(turn.input + turn.cacheRead + turn.cacheWrite)}</td>
                  <td>{formatTokens(turn.output)}</td>
                  <td>{turn.reasoning > 0 ? formatTokens(turn.reasoning) : "—"}</td>
                  <td>
                    {turn.toolCalls}
                    {turn.toolErrors > 0 && (
                      <span className="lens-err">{` (${turn.toolErrors} ${t("stats.errors")})`}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {analytics.tools.length > 0 && (
        <div className="lens-section">
          <h3>{t("stats.tools")}</h3>
          <table className="lens-table">
            <thead>
              <tr>
                <th>{t("stats.tool")}</th>
                <th>{t("stats.calls")}</th>
                <th>{t("stats.errors")}</th>
                <th>OK%</th>
                <th>{t("stats.duration")}</th>
              </tr>
            </thead>
            <tbody>
              {analytics.tools.map((tool) => (
                <tr key={tool.name}>
                  <td>
                    <code>{tool.name}</code>
                  </td>
                  <td>{tool.calls}</td>
                  <td>{tool.errors > 0 ? <span className="lens-err">{tool.errors}</span> : "0"}</td>
                  <td>{tool.calls > 0 ? Math.round(((tool.calls - tool.errors) / tool.calls) * 100) : 100}%</td>
                  <td>{formatDuration(tool.totalDurationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="lens-section">
        <h3>{t("stats.activity")}</h3>
        <div className="lens-activity">
          <span>
            <b>{act.compactions}</b> {t("stats.compactions")}
          </span>
          <span>
            <b>{act.compactionShadowedTokens > 0 ? formatTokens(act.compactionShadowedTokens) : "—"}</b>{" "}
            {t("stats.shadowed")}
          </span>
          <span>
            <b>
              {act.approvalsApproved}/{act.approvalsAsked}
            </b>{" "}
            {t("stats.approvals")}
          </span>
          <span>
            <b>{act.subagents}</b> {t("stats.subagents")}
          </span>
          <span>
            <b>{act.llmRetries}</b> {t("stats.retries")}
          </span>
        </div>
      </div>
    </>
  );
}

export function LensView({ sessionId, t }: LensViewProps) {
  ensureLensStyles();
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opts, setOpts] = useState<ExportOpts>(loadOpts);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/session-lens/analytics?sessionId=${encodeURIComponent(sessionId)}`);
      const body = (await res.json()) as {
        ok: boolean;
        live?: boolean;
        analytics?: SessionAnalytics;
        error?: string;
        message?: string;
      };
      if (body.ok && body.analytics) {
        setData({ analytics: body.analytics, live: body.live === true });
        setError(null);
      } else {
        setError(body.error === "session-not-found" ? "not-found" : (body.message ?? body.error ?? "unknown"));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Poll while the session is attached (live) so the tab doubles as a
  // real-time monitor; stopped sessions stay static.
  const live = data?.live === true;
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [live, load]);

  const updateOpts = (patch: Partial<ExportOpts>) => {
    setOpts((prev) => {
      const next = { ...prev, ...patch };
      saveOpts(next);
      return next;
    });
  };

  const exportUrl = `/api/session-lens/export?sessionId=${encodeURIComponent(sessionId)}&lang=${opts.lang}&full=${opts.full ? 1 : 0}&mask=${opts.mask ? 1 : 0}&theme=${opts.theme}`;

  return (
    <div className="lens-root">
      <div className="lens-toolbar">
        <div className="lens-title">
          <span>{data?.analytics.title ?? sessionId}</span>
          {live && <span className="lens-live">{t("toolbar.live")}</span>}
        </div>
        <label className="lens-check">
          <input
            type="checkbox"
            checked={opts.full}
            onChange={(event) => updateOpts({ full: event.target.checked })}
          />
          {t("toolbar.fullResults")}
        </label>
        <label className="lens-check">
          <input
            type="checkbox"
            checked={opts.mask}
            onChange={(event) => updateOpts({ mask: event.target.checked })}
          />
          {t("toolbar.maskPaths")}
        </label>
        <button
          type="button"
          className="lens-btn"
          onClick={() => updateOpts({ lang: opts.lang === "zh" ? "en" : "zh" })}
        >
          {t("toolbar.lang")}
        </button>
        <select
          className="lens-select"
          aria-label={t("toolbar.theme")}
          value={opts.theme}
          onChange={(event) => updateOpts({ theme: event.target.value as ExportTheme })}
        >
          <option value="dark">{t("toolbar.themeDark")}</option>
          <option value="system">{t("toolbar.themeSystem")}</option>
          <option value="light">{t("toolbar.themeLight")}</option>
        </select>
        <button type="button" className="lens-btn" onClick={() => void load()}>
          {t("toolbar.refresh")}
        </button>
        <a className="lens-btn lens-btn-primary" href={exportUrl} download>
          {t("toolbar.export")}
        </a>
      </div>

      {loading && data === null && <div className="lens-state">{t("state.loading")}</div>}
      {error !== null && (
        <div className="lens-state">
          <div>{error === "not-found" ? t("state.notFound") : `${t("state.error")}: ${error}`}</div>
          <button type="button" className="lens-btn" onClick={() => void load()}>
            {t("state.retry")}
          </button>
        </div>
      )}
      {data !== null && <AnalyticsView analytics={data.analytics} t={t} />}
    </div>
  );
}
