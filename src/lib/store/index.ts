import "server-only";
import path from "node:path";
import { REDIS_URL_NAMES, redisCredentials } from "../env";
import { createFileStore } from "./fileStore";
import { createRedisStore } from "./redisStore";
import type { Store } from "./types";

export type { Store } from "./types";

let store: Store | undefined;

/** Where local-mode data lives. DATA_DIR lets the E2E tests use a throwaway copy. */
export function localDataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATA_DIR ?? ".data");
}

/**
 * Upstash when its credentials are present (see env.ts for the names tried),
 * otherwise a local file.
 * Production refuses to fall back: a missing database there is a
 * misconfiguration, and silently writing to a throwaway disk would lose a
 * child's progress.
 */
export function getStore(): Store {
  if (store) return store;

  const redis = redisCredentials(process.env);

  if (redis) {
    store = createRedisStore(redis.url, redis.token);
  } else if (process.env.VERCEL) {
    throw new Error(
      `Redis is not configured: none of ${REDIS_URL_NAMES.join(", ")} (with a matching token) is set. Connect Upstash Redis to this Vercel project.`,
    );
  } else {
    store = createFileStore(localDataDir());
  }
  return store;
}
