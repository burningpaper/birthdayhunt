import "server-only";
import path from "node:path";
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
 * Upstash when its credentials are present (the Vercel Marketplace sets the
 * KV_* names; a direct Upstash setup uses UPSTASH_*), otherwise a local file.
 * Production refuses to fall back: a missing database there is a
 * misconfiguration, and silently writing to a throwaway disk would lose a
 * child's progress.
 */
export function getStore(): Store {
  if (store) return store;

  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    store = createRedisStore(url, token);
  } else if (process.env.VERCEL) {
    throw new Error("Redis is not configured. Connect Upstash Redis to this Vercel project.");
  } else {
    store = createFileStore(localDataDir());
  }
  return store;
}
