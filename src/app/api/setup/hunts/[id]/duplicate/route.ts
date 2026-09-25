import { jsonError } from "@/lib/api";
import { rejectUnlessAuthed } from "@/lib/auth";
import { duplicateHunt } from "@/lib/huntFactory";
import { getStore } from "@/lib/store";

export async function POST(_request: Request, ctx: RouteContext<"/api/setup/hunts/[id]/duplicate">) {
  const denied = await rejectUnlessAuthed();
  if (denied) return denied;
  const { id } = await ctx.params;
  const store = getStore();
  const source = await store.getHunt(id);
  if (!source) return jsonError(404, "That hunt doesn't exist.");

  const copy = duplicateHunt(source);
  await store.saveHunt(copy);
  return Response.json({ hunt: copy }, { status: 201 });
}
