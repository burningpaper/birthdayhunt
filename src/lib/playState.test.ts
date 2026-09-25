import { describe, expect, it } from "vitest";
import { newHunt } from "./huntFactory";
import { recordSolve, resolvePlayState, toPlayResponse } from "./playState";
import { emptyProgress, type Hunt, type Progress } from "./schema";

function activeHunt(): Hunt {
  const hunt = newHunt("Birthday Treasure Hunt");
  hunt.status = "active";
  hunt.treasureMessage = "Happy birthday!";
  hunt.stations = hunt.stations.map((s) => ({
    ...s,
    clue: { photoUrl: `/photo-${s.order}.jpg`, audioUrl: `/audio-${s.order}.m4a`, text: `riddle ${s.order}`, showText: false },
  }));
  return hunt;
}

function solveFirst(hunt: Hunt, count: number): Progress {
  let progress = emptyProgress(hunt.id);
  for (const station of hunt.stations.slice(0, count)) {
    progress = recordSolve(hunt, progress, station, new Date("2026-10-01T10:00:00Z"));
  }
  return progress;
}

function scan(hunt: Hunt | null, progress: Progress, index: number, overrides: Partial<{ key: string | null; preview: boolean }> = {}) {
  const station = hunt?.stations[index];
  return resolvePlayState({
    hunt,
    progress,
    stationId: station?.id ?? "nope",
    key: overrides.key !== undefined ? overrides.key : (station?.key ?? null),
    preview: overrides.preview ?? false,
  });
}

describe("resolvePlayState", () => {
  it("plays the first station on a fresh hunt", () => {
    const hunt = activeHunt();
    expect(scan(hunt, emptyProgress(hunt.id), 0).state).toBe("play");
  });

  it("plays the next expected station after earlier solves", () => {
    const hunt = activeHunt();
    expect(scan(hunt, solveFirst(hunt, 2), 2).state).toBe("play");
  });

  it("returns solved for a station already completed", () => {
    const hunt = activeHunt();
    expect(scan(hunt, solveFirst(hunt, 2), 0).state).toBe("solved");
  });

  it("says notYet when scanning ahead, pointing at the most recent earned clue", () => {
    const hunt = activeHunt();
    const decision = scan(hunt, solveFirst(hunt, 2), 4);
    expect(decision).toEqual({ state: "notYet", lastEarned: hunt.stations[1] });
  });

  it("says notYet with no clue when nothing has been solved", () => {
    const hunt = activeHunt();
    expect(scan(hunt, emptyProgress(hunt.id), 3)).toEqual({ state: "notYet", lastEarned: undefined });
  });

  it("rejects a wrong or missing key", () => {
    const hunt = activeHunt();
    expect(scan(hunt, emptyProgress(hunt.id), 0, { key: "zzzzzz" }).state).toBe("invalid");
    expect(scan(hunt, emptyProgress(hunt.id), 0, { key: null }).state).toBe("invalid");
  });

  it("rejects unknown hunts and stations", () => {
    const hunt = activeHunt();
    expect(scan(null, emptyProgress("x"), 0).state).toBe("invalid");
    expect(resolvePlayState({ hunt, progress: emptyProgress(hunt.id), stationId: "nope", key: "abcdef", preview: false }).state).toBe("invalid");
  });

  it("treats a draft hunt as invalid for live play", () => {
    const hunt = { ...activeHunt(), status: "draft" as const };
    expect(scan(hunt, emptyProgress(hunt.id), 0).state).toBe("invalid");
  });

  it("lets preview play any station of a draft hunt, out of order", () => {
    const hunt = { ...activeHunt(), status: "draft" as const };
    expect(scan(hunt, emptyProgress(hunt.id), 4, { preview: true }).state).toBe("play");
  });

  it("still checks the key in preview", () => {
    const hunt = activeHunt();
    expect(scan(hunt, emptyProgress(hunt.id), 0, { preview: true, key: "zzzzzz" }).state).toBe("invalid");
  });
});

describe("recordSolve", () => {
  it("records the station, its timestamp and the start time", () => {
    const hunt = activeHunt();
    const progress = recordSolve(hunt, emptyProgress(hunt.id), hunt.stations[0], new Date("2026-10-01T10:00:00Z"));
    expect(progress.completedStationIds).toEqual([hunt.stations[0].id]);
    expect(progress.solvedAt[hunt.stations[0].id]).toBe("2026-10-01T10:00:00.000Z");
    expect(progress.startedAt).toBe("2026-10-01T10:00:00.000Z");
    expect(progress.finishedAt).toBeUndefined();
  });

  it("is idempotent", () => {
    const hunt = activeHunt();
    const once = solveFirst(hunt, 1);
    expect(recordSolve(hunt, once, hunt.stations[0], new Date())).toBe(once);
  });

  it("sets finishedAt on the final station", () => {
    const hunt = activeHunt();
    expect(solveFirst(hunt, hunt.stations.length).finishedAt).toBe("2026-10-01T10:00:00.000Z");
  });
});

describe("toPlayResponse never leaks an unearned clue", () => {
  const leaks = (hunt: Hunt, response: unknown, index: number) => {
    const json = JSON.stringify(response);
    const { clue } = hunt.stations[index];
    return [clue.photoUrl, clue.audioUrl, clue.text].some((v) => v && json.includes(v));
  };

  it("sends no clue with a playable non-jigsaw station", () => {
    const hunt = activeHunt();
    const decision = scan(hunt, solveFirst(hunt, 1), 1);
    expect(leaks(hunt, toPlayResponse(hunt, decision), 1)).toBe(false);
  });

  it("sends only the photo for a jigsaw, never its audio or text", () => {
    const hunt = activeHunt();
    const response = toPlayResponse(hunt, scan(hunt, emptyProgress(hunt.id), 0));
    expect(response.state === "play" && response.puzzlePhotoUrl).toBe("/photo-1.jpg");
    const json = JSON.stringify(response);
    expect(json).not.toContain("/audio-1.m4a");
    expect(json).not.toContain("riddle 1");
  });

  it("reveals nothing about the scanned station when it is notYet", () => {
    const hunt = activeHunt();
    const response = toPlayResponse(hunt, scan(hunt, solveFirst(hunt, 1), 4));
    for (const i of [2, 3, 4, 5]) expect(leaks(hunt, response, i)).toBe(false);
    expect(response.state === "notYet" && response.lastEarnedClue?.photoUrl).toBe("/photo-1.jpg");
  });

  it("hides clue text unless the parent chose to show it", () => {
    const hunt = activeHunt();
    const hidden = toPlayResponse(hunt, scan(hunt, solveFirst(hunt, 1), 0));
    expect(hidden.state === "solved" && hidden.clue.text).toBeUndefined();

    hunt.stations[0].clue.showText = true;
    const shown = toPlayResponse(hunt, scan(hunt, solveFirst(hunt, 1), 0));
    expect(shown.state === "solved" && shown.clue.text).toBe("riddle 1");
  });

  it("adds the treasure message only on the final clue", () => {
    const hunt = activeHunt();
    const all = solveFirst(hunt, hunt.stations.length);
    const first = toPlayResponse(hunt, scan(hunt, all, 0));
    const last = toPlayResponse(hunt, scan(hunt, all, hunt.stations.length - 1));
    expect(first.state === "solved" && first.clue.treasureMessage).toBeUndefined();
    expect(last.state === "solved" && last.clue).toMatchObject({ isFinal: true, treasureMessage: "Happy birthday!" });
  });
});
