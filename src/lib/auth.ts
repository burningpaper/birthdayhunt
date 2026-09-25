import "server-only";
import { cookies } from "next/headers";
import { isValidSessionToken } from "./session";

export const SESSION_COOKIE = "hunt_setup";

type AuthConfig = { pin: string; secret: string };

/** Read SETUP_PIN and SESSION_SECRET, failing loudly if either is missing. */
export function authConfig(): AuthConfig {
  const pin = process.env.SETUP_PIN;
  const secret = process.env.SESSION_SECRET;
  if (!pin || !secret || secret.length < 32) {
    throw new Error(
      "SETUP_PIN and SESSION_SECRET (32+ characters) must be set. See .env.example.",
    );
  }
  return { pin, secret };
}

export async function isSetupAuthed(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return isValidSessionToken(token, authConfig().secret);
}

/** For route handlers: a 401 response when not signed in, otherwise null. */
export async function rejectUnlessAuthed(): Promise<Response | null> {
  if (await isSetupAuthed()) return null;
  return Response.json({ error: "Please sign in again." }, { status: 401 });
}
