/**
 * Build script: Node half → lib/index.js (ESM), browser half → lib/client.js
 * (hand-wrapped `__ModuleLoader__` bundle), pure functions → lib/analytics.js
 * etc. for reuse and testing. Requires no network access at install time —
 * the lib/ output is committed to the repo.
 */
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await mkdir("lib", { recursive: true });

const nodeExternal = ["node:*"];

// Node half: plain ESM, only node builtins external.
await build({
  entryPoints: ["src/index.ts"],
  outfile: "lib/index.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  external: nodeExternal,
  sourcemap: false,
  logLevel: "info",
});

// Pure modules published for reuse/tests (analytics, redact, export-html are
// already inlined into both bundles; these entries exist so importers can
// `require('dsh-session-lens/analytics')`).
await build({
  entryPoints: ["src/analytics.ts"],
  outfile: "lib/analytics.js",
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  logLevel: "info",
});

// Browser half: CJS body inside the host's `__ModuleLoader__` factory
// wrapper. react and the @deepseek-ai/* client modules stay external — the
// wrapper's `require` resolves them from the host (dsh.client.inject in
// package.json guarantees they are loadable).
const BANNER = `window.__ModuleLoader__.load({
	id: "dsh-session-lens",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;`;
const FOOTER = `		return module.exports;
	}
});`;

await build({
  entryPoints: ["src/client/index.tsx"],
  outfile: "lib/client.js",
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  external: ["react", "react/*", "@deepseek-ai/*"],
  banner: { js: BANNER },
  footer: { js: FOOTER },
  sourcemap: false,
  logLevel: "info",
});

console.log("build ok: lib/index.js, lib/analytics.js, lib/client.js");
