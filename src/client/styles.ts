/**
 * Panel styles: one injected stylesheet, BEM-ish `lens-` prefix, colors ONLY
 * from the host theme tokens (`--dsw-alias-*`, per docs/web-styling) with
 * neutral fallbacks so the panel still renders if a token is renamed.
 */
export const LENS_CSS = `
.lens-root{padding:16px 20px 28px;font-size:13px;color:var(--dsw-alias-label-primary,#1c1f24);max-width:920px;margin:0 auto}
.lens-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.lens-title{font-size:15px;font-weight:650;margin-right:auto;display:flex;align-items:center;gap:8px;min-width:0}
.lens-title span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lens-live{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#34c98e;font-weight:600}
.lens-live::before{content:"";width:7px;height:7px;border-radius:50%;background:#34c98e;animation:lens-pulse 1.6s infinite}
@keyframes lens-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.lens-btn{border:1px solid var(--dsw-alias-border-primary,#d8dde3);background:var(--dsw-alias-bg-primary,#fff);color:inherit;border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:inherit}
.lens-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#eef1f4)}
.lens-btn-primary{background:var(--dsw-alias-interactive-bg-brand,#4c8dff);border-color:transparent;color:#fff}
.lens-btn-primary:hover{background:var(--dsw-alias-interactive-bg-brand-hover,#3b7af0)}
.lens-check{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary,#5a6472);cursor:pointer;user-select:none}
.lens-chips{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}
.lens-chip{background:var(--dsw-alias-bg-secondary,#f6f7f9);border:1px solid var(--dsw-alias-border-secondary,#e3e7ec);border-radius:10px;padding:8px 14px;min-width:92px}
.lens-chip-value{font-size:16px;font-weight:650;font-variant-numeric:tabular-nums}
.lens-chip-label{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a94a1)}
.lens-section{margin-top:18px}
.lens-section h3{font-size:12px;font-weight:650;color:var(--dsw-alias-label-tertiary,#8a94a1);text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px}
.lens-bar{width:100%;border-radius:6px;overflow:hidden;display:block;background:var(--dsw-alias-bg-tertiary,#e9edf1)}
.lens-legend{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#5a6472)}
.lens-dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px}
.lens-table{width:100%;border-collapse:collapse;font-size:12px;background:var(--dsw-alias-bg-secondary,#f6f7f9);border:1px solid var(--dsw-alias-border-secondary,#e3e7ec);border-radius:10px;overflow:hidden}
.lens-table th,.lens-table td{text-align:left;padding:6px 12px;border-bottom:1px solid var(--dsw-alias-border-secondary,#eef1f4);font-variant-numeric:tabular-nums}
.lens-table th{color:var(--dsw-alias-label-tertiary,#8a94a1);font-weight:600}
.lens-table tr:last-child td{border-bottom:none}
.lens-table code{background:var(--dsw-alias-bg-tertiary,#e9edf1);border-radius:5px;padding:1px 6px}
.lens-err{color:#d6453d}
.lens-activity{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--dsw-alias-label-secondary,#5a6472)}
.lens-state{padding:48px 0;text-align:center;color:var(--dsw-alias-label-tertiary,#8a94a1)}
.lens-state button{margin-top:10px}
`;

let injected = false;

/** Inject the panel stylesheet once per document. */
export function ensureLensStyles(): void {
  if (injected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.dataset.sessionLens = "true";
  style.textContent = LENS_CSS;
  document.head.appendChild(style);
  injected = true;
}
