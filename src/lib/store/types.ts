import type { Hunt, Progress } from "../schema";

/**
 * Everything the app persists. Two implementations: Upstash Redis in
 * production, a JSON file for local development without cloud accounts.
 */
export interface Store {
  listHunts(): Promise<Hunt[]>;
  getHunt(id: string): Promise<Hunt | null>;
  saveHunt(hunt: Hunt): Promise<void>;
  deleteHunt(id: string): Promise<void>;

  getProgress(huntId: string): Promise<Progress | null>;
  saveProgress(progress: Progress): Promise<void>;
  deleteProgress(huntId: string): Promise<void>;

  /** Count a hit against `key` within a window. Returns the count so far. */
  countHit(key: string, windowSeconds: number): Promise<number>;
  /** How many hits `key` has in its current window, without adding one. */
  readHits(key: string): Promise<number>;
}
