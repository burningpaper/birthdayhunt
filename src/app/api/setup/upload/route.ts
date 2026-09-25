import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { jsonError } from "@/lib/api";
import { isSetupAuthed } from "@/lib/auth";
import { ALLOWED_MEDIA, MAX_UPLOAD_BYTES, mediaMode } from "@/lib/media";

/**
 * Vercel Blob client uploads (spec §8). The browser asks this route for a
 * short-lived token, then sends the file straight to Blob, which sidesteps
 * the serverless request-size limit for photos and voice clips.
 */
export async function POST(request: Request) {
  if (mediaMode() !== "blob") return jsonError(404, "Blob storage is not configured.");

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return jsonError(400, "The request was not valid JSON.");
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async () => {
        if (!(await isSetupAuthed())) throw new Error("Not signed in");
        return {
          allowedContentTypes: Object.keys(ALLOWED_MEDIA),
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("[upload] blob token request failed", error);
    return jsonError(400, "The upload couldn't start. Try again.");
  }
}
