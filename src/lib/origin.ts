/**
 * Turn a configured site address into a clean origin for QR codes.
 *
 * A QR code must hold a full URL. "birthdayhunt-phi.vercel.app/h/..."
 * without "https://" isn't a link to the iPad Camera app: it offers a web
 * search instead. So a bare host gets https:// added, trailing slashes and
 * paths are dropped, and anything unusable returns null (the caller then
 * falls back to the address the parent is actually using).
 */
export function normalizeOrigin(configured: string | undefined): string | null {
  const raw = configured?.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}
