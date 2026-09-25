import { jsonError, readJson } from "@/lib/api";
import { rejectUnlessAuthed } from "@/lib/auth";
import { renumber } from "@/lib/huntFactory";
import { HuntSchema, emptyProgress } from "@/lib/schema";
import { getStore } from "@/lib/store";
import { huntProblems } from "@/lib/validation";

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

/**
 * Save the whole hunt. The id and creation date always come from the stored
 * copy. Going live is refused, with the checklist, until the hunt is ready.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/setup/hunts/[id]">) {
  const denied = await rejectUnlessAuthed();
  if (denied) return denied;
  const { id } = await ctx.params;
  const store = getStore();
  const existing = await store.getHunt(id);
  if (!existing) return jsonError(404, "That hunt doesn't exist.");

  const parsed = await readJson(request, HuntSchema);
  if ("response" in parsed) return parsed.response;

  const hunt = {
    ...parsed.data,
    id: existing.id,
    createdAt: existing.createdAt,
    stations: renumber(parsed.data.stations),
  };

  if (hunt.status === "active") {
    const problems = huntProblems(hunt);
    if (problems.length > 0) {
      return jsonError(422, "This hunt isn't ready to go live yet.", { problems });
    }
  }

  await store.saveHunt(hunt);
  return Response.json({ hunt });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/setup/hunts/[id]">) {
  const denied = await rejectUnlessAuthed();
  if (denied) return denied;
  const { id } = await ctx.params;
  await getStore().deleteHunt(id);
  return Response.json({ ok: true });
}
