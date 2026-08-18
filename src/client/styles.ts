/**
 * Panel styles: one injected stylesheet, BEM-ish `lens-` prefix, colors ONLY
 * from the host theme tokens (`--dsw-alias-*`, per docs/web-styling). Some
 * host background tokens are optional, so the fallbacks use `light-dark()` to
 * stay in step with the surrounding DSH color scheme.
 */
export const LENS_CSS = `
.lens-root{--lens-text:light-dark(#1f2937,#dde2e8);--lens-secondary:light-dark(#5f6877,#a7b0bc);--lens-tertiary:light-dark(#778193,#8a94a1);--lens-surface:light-dark(#ffffff,#22262d);--lens-surface-muted:light-dark(#f5f7fa,#262b33);--lens-border:light-dark(#dce2ea,#2c313a);--lens-hover:light-dark(#eef4ff,#22262d);--lens-shadow:light-dark(0 1px 2px rgba(15,23,42,.04),0 0 transparent);padding:16px 20px 28px;font-size:13px;color:var(--dsw-alias-label-primary,var(--lens-text));max-width:920px;margin:0 auto}
body[data-ds-dark-theme] .lens-root{--lens-text:#dde2e8;--lens-secondary:#a7b0bc;--lens-tertiary:#8a94a1;--lens-surface:#22262d;--lens-surface-muted:#262b33;--lens-border:#2c313a;--lens-hover:#22262d;--lens-shadow:0 0 transparent}
.lens-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.lens-title{font-size:15px;font-weight:650;margin-right:auto;display:flex;align-items:center;gap:8px;min-width:0}
.lens-title span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lens-live{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#34c98e;font-weight:600}
.lens-live::before{content:"";width:7px;height:7px;border-radius:50%;background:#34c98e;animation:lens-pulse 1.6s infinite}
@keyframes lens-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.lens-btn{border:1px solid var(--dsw-alias-border-primary,var(--lens-border));background:var(--dsw-alias-bg-primary,var(--lens-surface));color:inherit;border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:inherit;box-shadow:var(--lens-shadow);transition:background-color .15s ease,border-color .15s ease}
.lens-btn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--lens-hover));border-color:light-dark(#b9cced,#3a414c)}
.lens-btn-primary{background:var(--dsw-alias-interactive-bg-brand,#4c8dff);border-color:transparent;color:#fff}
.lens-btn-primary:hover{background:var(--dsw-alias-interactive-bg-brand-hover,#3b7af0)}
.lens-select{border:1px solid var(--dsw-alias-border-primary,var(--lens-border));background:var(--dsw-alias-bg-primary,var(--lens-surface));color:inherit;border-radius:8px;padding:4px 6px;font-size:12px;font-family:inherit;box-shadow:var(--lens-shadow)}
.lens-check{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary,var(--lens-secondary));cursor:pointer;user-select:none}
.lens-chips{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}
.lens-chip{background:var(--dsw-alias-bg-secondary,var(--lens-surface));border:1px solid var(--dsw-alias-border-secondary,var(--lens-border));border-radius:10px;padding:8px 14px;min-width:92px;box-shadow:var(--lens-shadow)}
.lens-chip-value{font-size:16px;font-weight:650;font-variant-numeric:tabular-nums}
.lens-chip-label{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--lens-tertiary))}
.lens-section{margin-top:18px}
.lens-section h3{font-size:12px;font-weight:650;color:var(--dsw-alias-label-tertiary,var(--lens-tertiary));text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px}
.lens-bar{width:100%;border-radius:6px;overflow:hidden;display:block;background:var(--dsw-alias-bg-tertiary,var(--lens-surface-muted))}
.lens-legend{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px;font-size:12px;color:var(--dsw-alias-label-secondary,var(--lens-secondary))}
.lens-dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px}
.lens-table{width:100%;border-collapse:collapse;font-size:12px;background:var(--dsw-alias-bg-secondary,var(--lens-surface));border:1px solid var(--dsw-alias-border-secondary,var(--lens-border));border-radius:10px;overflow:hidden;box-shadow:var(--lens-shadow)}
.lens-table th,.lens-table td{text-align:left;padding:6px 12px;border-bottom:1px solid var(--dsw-alias-border-secondary,var(--lens-surface-muted));font-variant-numeric:tabular-nums}
.lens-table th{color:var(--dsw-alias-label-tertiary,var(--lens-tertiary));font-weight:600;background:light-dark(#f8fafc,#22262d)}
.lens-table tr:last-child td{border-bottom:none}
.lens-table tbody tr:hover{background:light-dark(#f8fbff,#22262d)}
.lens-table code{background:var(--dsw-alias-bg-tertiary,var(--lens-surface-muted));border-radius:5px;padding:1px 6px}
.lens-err{color:#e3635a}
.lens-activity{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--dsw-alias-label-secondary,var(--lens-secondary))}
.lens-state{padding:48px 0;text-align:center;color:var(--dsw-alias-label-tertiary,var(--lens-tertiary))}
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
