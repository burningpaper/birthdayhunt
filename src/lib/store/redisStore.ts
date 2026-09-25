import { Redis } from "@upstash/redis";
import type { Hunt, Progress } from "../schema";
import { parseHunt, parseProgress } from "./parse";
import type { Store } from "./types";

const HUNT_IDS = "hunts";
const huntKey = (id: string) => `hunt:${id}`;
const progressKey = (id: string) => `progress:${id}`;

/** Upstash Redis. Each hunt and progress record is one JSON value. */
export function createRedisStore(url: string, token: string): Store {
  const redis = new Redis({ url, token });

  return {
    async listHunts() {
      const ids = await redis.smembers(HUNT_IDS);
      if (ids.length === 0) return [];
      const raws = await redis.mget<unknown[]>(...ids.map(huntKey));
      return raws.map((raw, i) => parseHunt(raw, huntKey(ids[i]))).filter((h): h is Hunt => h !== null);
    },

    async getHunt(id) {
      return parseHunt(await redis.get(huntKey(id)), huntKey(id));
    },

    async saveHunt(hunt) {
      await redis.multi().set(huntKey(hunt.id), hunt).sadd(HUNT_IDS, hunt.id).exec();
    },

    async deleteHunt(id) {
      await redis.multi().del(huntKey(id), progressKey(id)).srem(HUNT_IDS, id).exec();
    },

    async getProgress(huntId) {
      return parseProgress(await redis.get(progressKey(huntId)), progressKey(huntId));
    },

    async saveProgress(progress: Progress) {
      await redis.set(progressKey(progress.huntId), progress);
    },

    async deleteProgress(huntId) {
      await redis.del(progressKey(huntId));
    },

    async countHit(key, windowSeconds) {
      const fullKey = `hits:${key}`;
      const [count] = await redis.multi().incr(fullKey).expire(fullKey, windowSeconds, "NX").exec<[number, number]>();
      return count;
    },
  };
}
