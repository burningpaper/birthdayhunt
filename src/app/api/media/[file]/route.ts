import { readFile } from "node:fs/promises";
import path from "node:path";
import { contentTypeFor, isSafeMediaName, localUploadDir } from "@/lib/media";

/**
 * Serves locally stored uploads. Honours Range requests, because Safari will
 * not play an <audio> source whose server can't answer them.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/media/[file]">) {
  const { file } = await ctx.params;
  if (!isSafeMediaName(file)) return new Response("Not found", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readFile(path.join(localUploadDir(), file));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers = {
    "Content-Type": contentTypeFor(file),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (!range) {
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Length": String(bytes.length) } });
  }

  const size = bytes.length;
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start > end || start >= size) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
    status: 206,
    headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
  });
}
