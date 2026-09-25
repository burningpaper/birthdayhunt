/**
 * Reading configuration from the environment, defensively.
 *
 * Two real-world traps shaped this file. Importing `.env.example` into
 * Vercel creates variables that exist but are blank, and `??` happily passes
 * an empty string through. And when the plain `KV_*` names are already taken,
 * the Upstash integration adds its credentials under a prefix (here
 * `STORAGE_`). So: blank means missing, and several names are tried in order.
 */

type Env = Record<string, string | undefined>;

/** The first variable among `names` that is set to something non-blank. */
export function firstSet(env: Env, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export const REDIS_URL_NAMES = ["KV_REST_API_URL", "STORAGE_KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"];
export const REDIS_TOKEN_NAMES = ["KV_REST_API_TOKEN", "STORAGE_KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"];

export function redisCredentials(env: Env): { url: string; token: string } | null {
  const url = firstSet(env, REDIS_URL_NAMES);
  const token = firstSet(env, REDIS_TOKEN_NAMES);
  return url && token ? { url, token } : null;
}

export const MIN_SECRET_LENGTH = 32;

/** Exactly what is wrong with the setup auth config, in words a parent can act on. */
export function authConfigProblems(env: Env): string[] {
  const problems: string[] = [];
  if (!firstSet(env, ["SETUP_PIN"])) problems.push("SETUP_PIN is missing or blank");
  const secret = firstSet(env, ["SESSION_SECRET"]);
  if (!secret) problems.push("SESSION_SECRET is missing or blank");
  else if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(`SESSION_SECRET is ${secret.length} characters; it needs at least ${MIN_SECRET_LENGTH}`);
  }
  return problems;
}
