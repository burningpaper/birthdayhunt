import { jsonError, readJson } from "@/lib/api";
import { rejectUnlessAuthed } from "@/lib/auth";
import { applySave } from "@/lib/huntSave";
import { HuntSchema, emptyProgress } from "@/lib/schema";
import { getStore } from "@/lib/store";

export async function GET(_request: Request, ctx: RouteContext<"/api/setup/hunts/[id]">) {
  const denied = await rejectUnlessAuthed();
  if (denied) return denied;
  const { id } = await ctx.params;
  const store = getStore();
  const hunt = await store.getHunt(id);
  if (!hunt) return jsonError(404, "That hunt doesn't exist.");
  const progress = (await store.getProgress(id)) ?? emptyProgress(id);
  return Response.json({ hunt, progress });
}

/** Save the whole hunt. The rules (including refusing stale saves) live in lib/huntSave.ts. */
export async function PUT(request: Request, ctx: RouteContext<"/api/setup/hunts/[id]">) {
  const denied = await rejectUnlessAuthed();
  if (denied) return denied;
  const { id } = await ctx.params;
  const store = getStore();
  const existing = await store.getHunt(id);
  if (!existing) return jsonError(404, "That hunt doesn't exist.");

  const parsed = await readJson(request, HuntSchema);
  if ("response" in parsed) return parsed.response;

  const result = applySave(existing, parsed.data);
  if (!result.ok) {
    if (result.status === 409) console.warn(`[setup] refused a stale save of ${id}: based on revision ${parsed.data.revision}, stored is ${existing.revision}`);
    return Response.json(result.body, { status: result.status });
  }
  await store.saveHunt(result.hunt);
  return Response.json({ hunt: result.hunt });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/setup/hunts/[id]">) {
  const denied = await rejectUnlessAuthed();
  if (denied) return denied;
  const { id } = await ctx.params;
  await getStore().deleteHunt(id);
  return Response.json({ ok: true });
}
