import "server-only";
import path from "node:path";
import { localDataDir } from "./store";

export type MediaMode = "blob" | "local";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Content types a parent can upload, with the extension used when stored locally. */
export const ALLOWED_MEDIA: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
};

const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  m4a: "audio/mp4",
  aac: "audio/aac",
  mp3: "audio/mpeg",
  webm: "audio/webm",
  ogg: "audio/ogg",
};

export function mediaMode(): MediaMode {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ? "blob" : "local";
}

export function localUploadDir(): string {
  return path.join(/*turbopackIgnore: true*/ localDataDir(), "uploads");
}

/** Only our own generated names are servable: no paths, no surprises. */
export function isSafeMediaName(name: string): boolean {
  return /^[a-z0-9]{16}\.[a-z0-9]{2,4}$/.test(name);
}

export function contentTypeFor(name: string): string {
  return TYPE_BY_EXTENSION[name.split(".").pop() ?? ""] ?? "application/octet-stream";
}

/** The base type without codec parameters: "audio/webm;codecs=opus" → "audio/webm". */
export function baseContentType(type: string | null): string {
  return (type ?? "").split(";")[0].trim().toLowerCase();
}
