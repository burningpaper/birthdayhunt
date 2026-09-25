import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newHunt } from "../huntFactory";
import { emptyProgress } from "../schema";
import { createFileStore } from "./fileStore";
import type { Store } from "./types";

let dir: string;
let store: Store;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "hunt-store-"));
  store = createFileStore(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("file store", () => {
  it("starts empty", async () => {
    expect(await store.listHunts()).toEqual([]);
    expect(await store.getHunt("missing")).toBeNull();
  });

  it("saves, lists and deletes hunts along with their progress", async () => {
    const hunt = newHunt("Birthday");
    await store.saveHunt(hunt);
    await store.saveProgress({ ...emptyProgress(hunt.id), completedStationIds: [hunt.stations[0].id] });

    expect(await store.getHunt(hunt.id)).toEqual(hunt);
    expect(await store.listHunts()).toHaveLength(1);

    await store.deleteHunt(hunt.id);
    expect(await store.getHunt(hunt.id)).toBeNull();
    expect(await store.getProgress(hunt.id)).toBeNull();
  });

  it("counts hits within a window", async () => {
    expect(await store.countHit("login:1.2.3.4", 60)).toBe(1);
    expect(await store.countHit("login:1.2.3.4", 60)).toBe(2);
    expect(await store.countHit("login:5.6.7.8", 60)).toBe(1);
  });
});
