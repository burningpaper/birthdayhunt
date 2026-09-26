import jsQR from "jsqr";

/**
 * The in-page scanner's two pure jobs: find a QR code in a camera frame,
 * and decide whether its text is one of our treasure codes.
 *
 * The scanner only ever navigates to a station path on this site, never to
 * whatever link a random QR code holds.
 */

const STATION_PATH = /^\/h\/[a-z0-9-]{3,40}\/s\/[a-z0-9]{1,16}$/;
const KEY = /^[a-z0-9]{6}$/;

/** "https://any-host/h/{hunt}/s/{station}?k={key}" → "/h/{hunt}/s/{station}?k={key}", else null. */
export function treasurePathFrom(text: string): string | null {
  const raw = text.trim();
  // Codes printed before the QR fix hold the address without "https://".
  const withScheme = /^https?:\/\//i.test(raw) ? raw : /^[a-z0-9.-]+(:\d+)?\//i.test(raw) ? `https://${raw}` : null;
  if (!withScheme) return null;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  const key = url.searchParams.get("k") ?? "";
  if (!STATION_PATH.test(url.pathname) || !KEY.test(key)) return null;
  return `${url.pathname}?k=${key}`;
}

/** The text of a QR code in an RGBA frame, or null if none is readable. */
export function decodeFrame(data: Uint8ClampedArray, width: number, height: number): string | null {
  const result = jsQR(data, width, height, { inversionAttempts: "dontInvert" });
  return result?.data ? result.data : null;
}
