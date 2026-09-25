import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The parent's session is a signed expiry timestamp: `<expiresAtMs>.<hmac>`.
 * There are no accounts, so there is nothing else to store. Pure functions,
 * kept apart from Next's cookie API so they can be unit tested.
 */

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSessionToken(secret: string, now: number = Date.now()): string {
  const expiresAt = String(now + SESSION_TTL_SECONDS * 1000);
  return `${expiresAt}.${sign(expiresAt, secret)}`;
}

export function isValidSessionToken(token: string | undefined, secret: string, now: number = Date.now()): boolean {
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature) return false;
  if (!safeEqual(signature, sign(expiresAt, secret))) return false;
  return Number(expiresAt) > now;
}

/**
 * Constant-time PIN comparison. Both sides are HMACed first so they are equal
 * length, which `timingSafeEqual` requires, without leaking the PIN's length.
 */
export function pinMatches(attempt: string, pin: string, secret: string): boolean {
  return safeEqual(sign(attempt, secret), sign(pin, secret));
}
