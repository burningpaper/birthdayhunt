"use client";

import { upload } from "@vercel/blob/client";

export type MediaMode = "blob" | "local";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Shrink a photo to at most 1600px on its long edge and re-encode as JPEG
 * (spec §7.2). An iPad camera photo drops from ~4 MB to ~300 KB, which
 * matters on the day: every clue photo loads fast on the house Wi-Fi.
 * `createImageBitmap` honours EXIF orientation, so sideways photos stay upright.
 */
export async function resizePhoto(file: File, maxEdge: number = MAX_EDGE): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't process photos.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't compress the photo."))), "image/jpeg", JPEG_QUALITY),
  );
}

/** Upload a file and return its public URL, via Blob or the local dev store. */
export async function uploadMedia(body: Blob, filename: string, mode: MediaMode): Promise<string> {
  const contentType = body.type.split(";")[0] || "application/octet-stream";

  if (mode === "blob") {
    const result = await upload(`hunt-media/${filename}`, body, {
      access: "public",
      handleUploadUrl: "/api/setup/upload",
      contentType,
    });
    return result.url;
  }

  const res = await fetch("/api/setup/upload-local", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "The upload didn't work. Try again.");
  return data.url;
}
