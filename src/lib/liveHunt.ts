import type { Hunt } from "./schema";

/**
 * The hunt the front page starts: the live one that went live most
 * recently. Hunts made live before `activatedAt` existed fall back to when
 * they were created.
 */
export function currentLiveHunt(hunts: Hunt[]): Hunt | null {
  const live = hunts.filter((h) => h.status === "active");
  const since = (h: Hunt) => h.activatedAt ?? h.createdAt;
  return live.sort((a, b) => since(b).localeCompare(since(a)))[0] ?? null;
}
