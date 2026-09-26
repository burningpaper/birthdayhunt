import { describe, expect, it } from "vitest";
import { newHunt } from "./huntFactory";
import { applySave } from "./huntSave";
import type { Hunt } from "./schema";

function readyHunt(): Hunt {
  const hunt = newHunt("Birthday");
  hunt.stations = hunt.stations.map((s) => ({ ...s, clue: { photoUrl: "/p.jpg", showText: false } }));
  for (const s of hunt.stations) {
    if (s.puzzle.type === "countingLock") s.puzzle.questions = s.puzzle.questions.map(() => ({ questionText: "How many?", answer: 2 }));
  }
  return hunt;
}

describe("applySave", () => {
  it("stamps the moment a hunt goes live, with the server's clock, and keeps it through later saves", () => {
    const draft = readyHunt();
    const wentLive = applySave(draft, { ...draft, status: "active", activatedAt: "1999-01-01T00:00:00.000Z" }, new Date("2026-09-26T09:00:00Z"));
    expect(wentLive).toMatchObject({ ok: true, hunt: { activatedAt: "2026-09-26T09:00:00.000Z" } });
    if (!wentLive.ok) return;
    const edited = applySave(wentLive.hunt, { ...wentLive.hunt, childName: "Sam" }, new Date("2026-09-27T09:00:00Z"));
    expect(edited).toMatchObject({ ok: true, hunt: { activatedAt: "2026-09-26T09:00:00.000Z" } });
  });

  it("accepts a save based on the latest revision and bumps the revision", () => {
    const stored = { ...newHunt("Birthday"), revision: 4 };
    const result = applySave(stored, { ...stored, childName: "Sam" });
    expect(result).toMatchObject({ ok: true, hunt: { childName: "Sam", revision: 5 } });
  });

  it("refuses a save based on an older revision, so a stale tab can't wipe newer work", () => {
    const stored = { ...newHunt("Birthday"), revision: 5, childName: "Sam" };
    const stale = { ...stored, revision: 4, childName: undefined };
    const result = applySave(stored, stale);
    expect(result).toMatchObject({ ok: false, status: 409 });
    if (!result.ok) expect(result.body.hunt).toEqual(stored);
  });

  it("keeps the stored id and creation date whatever the client sends", () => {
    const stored = newHunt("Birthday");
    const result = applySave(stored, { ...stored, id: "someone-else", createdAt: "1999-01-01" });
    expect(result.ok && result.hunt.id).toBe(stored.id);
    expect(result.ok && result.hunt.createdAt).toBe(stored.createdAt);
  });

  it("renumbers stations to match their order", () => {
    const stored = newHunt("Birthday");
    const reversed = { ...stored, stations: [...stored.stations].reverse() };
    const result = applySave(stored, reversed);
    expect(result.ok && result.hunt.stations.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("refuses to go live with problems, listing them", () => {
    const stored = newHunt("Birthday");
    const result = applySave(stored, { ...stored, status: "active" });
    expect(result).toMatchObject({ ok: false, status: 422 });
    if (!result.ok) expect(result.body.problems?.length).toBeGreaterThan(0);
  });

  it("goes live when the hunt is ready", () => {
    const stored = readyHunt();
    expect(applySave(stored, { ...stored, status: "active" })).toMatchObject({ ok: true, hunt: { status: "active" } });
  });
});
