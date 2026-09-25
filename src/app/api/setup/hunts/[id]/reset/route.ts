import { rejectUnlessAuthed } from "@/lib/auth";
import { getStore } from "@/lib/store";

/** Wipe the child's progress so the hunt can be played again from station 1. */
export async function POST(_request: Request, ctx: RouteContext<"/api/setup/hunts/[id]/reset">) {
  const denied = await rejectUnlessAuthed();
  if (denied) return denied;
  const { id } = await ctx.params;
  await getStore().deleteProgress(id);
  return Response.json({ ok: true });
}
