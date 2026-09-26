import "server-only";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { normalizeOrigin } from "./origin";
import type { Hunt, Station } from "./schema";

/**
 * The absolute URL printed into each QR code. NEXT_PUBLIC_SITE_URL wins when
 * set (so a sheet printed from a preview deploy still points at production);
 * otherwise the host the parent is using right now.
 */
export async function siteOrigin(): Promise<string> {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;
  if (process.env.NEXT_PUBLIC_SITE_URL) console.warn("[qr] NEXT_PUBLIC_SITE_URL is not a usable address; using this request's host");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export function stationUrl(origin: string, hunt: Hunt, station: Station): string {
  return `${origin}/h/${hunt.id}/s/${station.id}?k=${station.key}`;
}

/** An SVG QR code. Error correction M survives a crease or a thumbprint. */
export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#14213F", light: "#FFFFFF" } });
}
