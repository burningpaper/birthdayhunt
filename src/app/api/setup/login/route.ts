import { cookies } from "next/headers";
import { z } from "zod";
import { clientIp, jsonError, readJson } from "@/lib/api";
import { SESSION_COOKIE, authConfig } from "@/lib/auth";
import { SESSION_TTL_SECONDS, createSessionToken, pinMatches } from "@/lib/session";
import { getStore } from "@/lib/store";

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

const LoginBody = z.object({ pin: z.string().min(1).max(32) });

export async function POST(request: Request) {
  const parsed = await readJson(request, LoginBody);
  if ("response" in parsed) return parsed.response;

  const attempts = await getStore().countHit(`login:${clientIp(request)}`, WINDOW_SECONDS);
  if (attempts > MAX_ATTEMPTS) {
    return jsonError(429, "Too many tries. Wait 15 minutes and try again.");
  }

  const { pin, secret } = authConfig();
  if (!pinMatches(parsed.data.pin, pin, secret)) {
    return jsonError(401, "That PIN didn't match. Try again.");
  }

  (await cookies()).set(SESSION_COOKIE, createSessionToken(secret), {
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return Response.json({ ok: true });
}

/** https on Vercel (behind its proxy), plain http for a local production build. */
function isHttps(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return (forwarded ?? new URL(request.url).protocol.replace(":", "")) === "https";
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
