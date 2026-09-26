/**
 * Choosing a recording format. The recording is played back on the child's
 * iPad in Safari, so MP4/AAC comes first: Safari records it natively, and
 * recent Chrome can too. WebM and Ogg are fallbacks for browsers that can't.
 */

export const RECORDING_MIME_PREFERENCE = [
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
] as const;

/** The first format this browser can record, or undefined to let it choose. */
export function pickRecordingMime(isTypeSupported: (mime: string) => boolean): string | undefined {
  return RECORDING_MIME_PREFERENCE.find((mime) => isTypeSupported(mime));
}

/** File extension for an upload, from a type like "audio/webm;codecs=opus". */
export function recordingExtension(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base === "audio/mp4" || base === "audio/x-m4a" || base === "audio/aac") return "m4a";
  if (base === "audio/webm") return "webm";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mpeg") return "mp3";
  return "m4a";
}

/** WebM may not play on older iPads, so the parent gets a gentle nudge. */
export function mightNotPlayOnIpad(mime: string): boolean {
  const base = mime.split(";")[0].trim().toLowerCase();
  return base === "audio/webm" || base === "audio/ogg";
}

/** Audio files a parent can upload, by extension: the type to store them as. */
const UPLOAD_TYPES: Record<string, string> = {
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  webm: "audio/webm",
};

/** The biggest audio file the server accepts (it matches lib/media.ts). */
export const MAX_AUDIO_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * What an uploaded audio file should be stored as, or null if it isn't one
 * we can play. Browsers label files inconsistently (an .m4a can arrive as
 * "audio/x-m4a", or with no type at all), so the extension decides.
 */
export function uploadAudioType(fileName: string): { type: string; extension: string } | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const type = UPLOAD_TYPES[extension];
  return type ? { type, extension: extension === "mp4" ? "m4a" : extension } : null;
}

/** "0:07" style timer text. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
