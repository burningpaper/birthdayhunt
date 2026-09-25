import { z } from "zod";
import { readJson } from "@/lib/api";
import { rejectUnlessAuthed } from "@/lib/auth";
import { newHunt } from "@/lib/huntFactory";
import { getStore } from "@/lib/store";

export async function GET() {
  const denied = await rejectUnlessAuthed();
  if (denied) return denied;
  const hunts = await getStore().listHunts();
  return Response.json({ hunts });
}

const CreateBody = z.object({ title: z.string().trim().min(1).max(80) });

export async function POST(request: Request) {
  const denied = await rejectUnlessAuthed();
  if (denied) return denied;
  const parsed = await readJson(request, CreateBody);
  if ("response" in parsed) return parsed.response;

  const hunt = newHunt(parsed.data.title);
  await getStore().saveHunt(hunt);
  return Response.json({ hunt }, { status: 201 });
}
