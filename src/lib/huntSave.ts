import { renumber } from "./huntFactory";
import type { Hunt } from "./schema";
import { huntProblems } from "./validation";

export type SaveResult =
  | { ok: true; hunt: Hunt }
  | { ok: false; status: 409 | 422; body: { error: string; problems?: string[]; hunt?: Hunt } };

/**
 * The rules for saving a whole hunt from the editor, kept pure so they can
 * be tested:
 *
 * - The save must be based on the stored revision. Otherwise someone (a
 *   second tab, another device, a page restored by the Back button) saved
 *   in between, and taking this copy would silently erase their work. The
 *   client gets the current hunt back so it can reload.
 * - The id and creation date always come from the stored copy.
 * - Stations are renumbered to match their order.
 * - Going live is refused, with the checklist, until the hunt is ready.
 */
export function applySave(stored: Hunt, incoming: Hunt): SaveResult {
  if (incoming.revision !== stored.revision) {
    return {
      ok: false,
      status: 409,
      body: { error: "This hunt was changed somewhere else (another tab or device).", hunt: stored },
    };
  }

  const hunt: Hunt = {
    ...incoming,
    id: stored.id,
    createdAt: stored.createdAt,
    stations: renumber(incoming.stations),
    revision: stored.revision + 1,
  };

  if (hunt.status === "active") {
    const problems = huntProblems(hunt);
    if (problems.length > 0) return { ok: false, status: 422, body: { error: "This hunt isn't ready to go live yet.", problems } };
  }
  return { ok: true, hunt };
}
