import { NO_STORE, loadScan } from "@/lib/play";
import { toPlayResponse } from "@/lib/playState";

export async function GET(request: Request, ctx: RouteContext<"/api/play/[huntId]/[stationId]">) {
  const { huntId, stationId } = await ctx.params;
  const { hunt, decision } = await loadScan(huntId, stationId, new URL(request.url).searchParams);
  return Response.json(toPlayResponse(hunt, decision), { headers: NO_STORE });
}
