import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Hunt, Progress } from "../schema";
import { parseHunt, parseProgress } from "./parse";
import type { Store } from "./types";

type Db = { hunts: Record<string, unknown>; progress: Record<string, unknown> };

/**
 * A single JSON file under `.data/`, for running the whole app on localhost
 * with no cloud accounts. Not for production: one process, no locking.
 */
export function createFileStore(dir: string): Store {
  const file = path.join(dir, "db.json");
  const hits = new Map<string, { count: number; resetAt: number }>();

  async function load(): Promise<Db> {
    try {
      return JSON.parse(await readFile(file, "utf8")) as Db;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { hunts: {}, progress: {} };
      throw error;
    }
  }

  async function save(db: Db) {
    await mkdir(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(db, null, 2));
    await rename(tmp, file);
  }

  return {
    async listHunts() {
      const db = await load();
      return Object.entries(db.hunts)
        .map(([id, raw]) => parseHunt(raw, `hunt:${id}`))
        .filter((h): h is Hunt => h !== null);
    },

    async getHunt(id) {
      return parseHunt((await load()).hunts[id], `hunt:${id}`);
    },

    async saveHunt(hunt) {
      const db = await load();
      db.hunts[hunt.id] = hunt;
      await save(db);
    },

    async deleteHunt(id) {
      const db = await load();
      delete db.hunts[id];
      delete db.progress[id];
      await save(db);
    },

    async getProgress(huntId) {
      return parseProgress((await load()).progress[huntId], `progress:${huntId}`);
    },

    async saveProgress(progress: Progress) {
      const db = await load();
      db.progress[progress.huntId] = progress;
      await save(db);
    },

    async deleteProgress(huntId) {
      const db = await load();
      delete db.progress[huntId];
      await save(db);
    },

    async countHit(key, windowSeconds) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt < now) {
        hits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
        return 1;
      }
      entry.count += 1;
      return entry.count;
    },

    async readHits(key) {
      const entry = hits.get(key);
      return entry && entry.resetAt >= Date.now() ? entry.count : 0;
    },
  };
}
