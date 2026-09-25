import { jsonError } from "@/lib/api";
import { NO_STORE, loadScan } from "@/lib/play";
import { clueView, recordSolve } from "@/lib/playState";
import { getStore } from "@/lib/store";

/**
 * Record a solve and hand over the clue it earned. Idempotent, so a double
 * tap or a flaky connection retry is harmless. Preview never writes progress.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/play/[huntId]/[stationId]/solve">) {
  const { huntId, stationId } = await ctx.params;
  const { hunt, progress, decision, preview } = await loadScan(huntId, stationId, new URL(request.url).searchParams);

  if (!hunt || decision.state === "invalid") return jsonError(404, "That's not a treasure code.");
  if (decision.state === "notYet") return jsonError(409, "There's another clue to find first.");

  const { station } = decision;
  if (decision.state === "play" && !preview) {
    await getStore().saveProgress(recordSolve(hunt, progress, station, new Date()));
  }
  return Response.json({ clue: clueView(hunt, station) }, { headers: NO_STORE });
}
