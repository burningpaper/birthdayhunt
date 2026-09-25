import "server-only";
import { cookies } from "next/headers";
import { authConfigProblems } from "./env";
import { isValidSessionToken } from "./session";

export const SESSION_COOKIE = "hunt_setup";

type AuthConfig = { pin: string; secret: string };

/** Read SETUP_PIN and SESSION_SECRET, failing loudly and specifically if either is unusable. */
export function authConfig(): AuthConfig {
  const problems = authConfigProblems(process.env);
  if (problems.length > 0) {
    throw new Error(`Setup auth is misconfigured: ${problems.join("; ")}. See .env.example.`);
  }
  return { pin: process.env.SETUP_PIN!.trim(), secret: process.env.SESSION_SECRET!.trim() };
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
