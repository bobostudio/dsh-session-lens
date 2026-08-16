/**
 * dsh-session-lens — browser half.
 *
 * Contributes one `conversation.view` slot entry: a "Lens" tab beside
 * Chat/Trajectory that renders the analytics served by the Node half, plus
 * export controls that download the redacted single-file HTML replay.
 *
 * The bundle is wrapped by scripts/build.mjs into the host's
 * `__ModuleLoader__` factory format; react and @deepseek-ai/* client modules
 * stay external and are resolved by the host loader (see dsh.client.inject
 * in package.json).
 */

import { en, NS, zh, type LensKey } from "./locales.ts";
import { LensView } from "./lens-view.tsx";

/** Stable client plugin name (mirrors the Node half). */
export const name = "session-lens";

/** Client services required before this plugin activates. */
export const inject = ["slots", "locale"];

export function apply(ctx: any): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "session-lens: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.slots.inject("conversation.view", () =>
    ctx.slots.register(
      {
        name: "conversation.view",
        id: "session-lens",
        order: 20,
        locale: NS,
        label: () => t("view.lens"),
        inject: (sessionId: string): { sessionId: string; t: (key: LensKey) => string } => ({
          sessionId,
          t,
        }),
      },
      LensView,
    ),
  );
}
