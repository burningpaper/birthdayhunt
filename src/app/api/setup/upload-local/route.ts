import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { jsonError } from "@/lib/api";
import { rejectUnlessAuthed } from "@/lib/auth";
import { ALLOWED_MEDIA, MAX_UPLOAD_BYTES, baseContentType, localUploadDir, mediaMode } from "@/lib/media";

/** Local development stand-in for Blob: the raw file body is written to .data/uploads. */
export async function POST(request: Request) {
  if (mediaMode() !== "local" || process.env.VERCEL) return jsonError(404, "Local uploads are disabled here.");
  const denied = await rejectUnlessAuthed();
  if (denied) return denied;

  const extension = ALLOWED_MEDIA[baseContentType(request.headers.get("content-type"))];
  if (!extension) return jsonError(415, "Only photos and audio recordings can be uploaded.");

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0) return jsonError(400, "That file was empty.");
  if (bytes.length > MAX_UPLOAD_BYTES) return jsonError(413, "That file is too big (10 MB max).");

  const name = `${randomBytes(8).toString("hex")}.${extension}`;
  await mkdir(localUploadDir(), { recursive: true });
  await writeFile(path.join(localUploadDir(), name), bytes);
  return Response.json({ url: `/api/media/${name}` }, { status: 201 });
}
