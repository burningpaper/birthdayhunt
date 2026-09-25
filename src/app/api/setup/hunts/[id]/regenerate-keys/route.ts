import { jsonError } from "@/lib/api";
import { rejectUnlessAuthed } from "@/lib/auth";
import { regenerateKeys } from "@/lib/huntFactory";
import { getStore } from "@/lib/store";

/** New keys for every station. Every previously printed QR code stops working. */
export async function POST(_request: Request, ctx: RouteContext<"/api/setup/hunts/[id]/regenerate-keys">) {
  const denied = await rejectUnlessAuthed();
  if (denied) return denied;
  const { id } = await ctx.params;
  const store = getStore();
  const hunt = await store.getHunt(id);
  if (!hunt) return jsonError(404, "That hunt doesn't exist.");

  const rekeyed = regenerateKeys(hunt);
  await store.saveHunt(rekeyed);
  return Response.json({ hunt: rekeyed });
}
