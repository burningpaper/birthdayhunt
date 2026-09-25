import "server-only";
import { isSetupAuthed } from "./auth";
import { resolvePlayState, type PlayDecision } from "./playState";
import { emptyProgress, type Hunt, type Progress } from "./schema";
import { getStore } from "./store";

export type Scan = { hunt: Hunt | null; progress: Progress; decision: PlayDecision; preview: boolean };

/**
 * Load everything a scan needs and decide what it means. Preview (the
 * parent's test mode) is honoured only with a valid setup session, so a
 * child can't add `&preview=1` to skip ahead.
 */
export async function loadScan(huntId: string, stationId: string, searchParams: URLSearchParams): Promise<Scan> {
  const store = getStore();
  const preview = searchParams.get("preview") === "1" && (await isSetupAuthed());
  const hunt = await store.getHunt(huntId);
  const progress = (hunt && (await store.getProgress(hunt.id))) || emptyProgress(huntId);
  const decision = resolvePlayState({ hunt, progress, stationId, key: searchParams.get("k"), preview });
  return { hunt, progress, decision, preview };
}

export const NO_STORE = { "Cache-Control": "no-store" };
