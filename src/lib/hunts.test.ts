import { describe, expect, it } from "vitest";
import { applyDifficulty, defaultPuzzle, withLockDigits } from "./difficulty";
import { duplicateHunt, newHunt, regenerateKeys, setHuntDifficulty, slugify } from "./huntFactory";
import { PUZZLE_META, isPuzzleReady } from "./puzzleMeta";
import { HuntSchema, PUZZLE_TYPES } from "./schema";
import { clueTargetLabel, huntProblems } from "./validation";

describe("difficulty presets", () => {
  it("uses the spec's age-7 defaults at medium", () => {
    expect(defaultPuzzle("jigsaw", "medium")).toEqual({ type: "jigsaw", pieces: 12, rotation: false });
    expect(defaultPuzzle("marbleRun", "medium")).toEqual({ type: "marbleRun", level: 3 });
    expect(defaultPuzzle("trainTrack", "medium")).toEqual({ type: "trainTrack", gridSize: 5 });
    expect(defaultPuzzle("memoryMatch", "medium")).toEqual({ type: "memoryMatch", pairs: 10 });
    expect(defaultPuzzle("flickGolf", "medium")).toEqual({ type: "flickGolf", holes: 3 });
    expect(defaultPuzzle("countingLock", "medium")).toMatchObject({ type: "countingLock", digits: 3 });
  });

  it("changes every puzzle between easy and hard", () => {
    for (const type of PUZZLE_TYPES) {
      expect(defaultPuzzle(type, "easy")).not.toEqual(defaultPuzzle(type, "hard"));
    }
  });

  it("keeps the parent's memory photos and lock questions when the preset changes", () => {
    const memory = { type: "memoryMatch" as const, pairs: 10 as const, photoUrls: ["/a.jpg"] };
    expect(applyDifficulty(memory, "hard")).toEqual({ type: "memoryMatch", pairs: 12, photoUrls: ["/a.jpg"] });

    const lock = {
      type: "countingLock" as const,
      digits: 3 as const,
      questions: [
        { questionText: "Cushions?", answer: 4 },
        { questionText: "Windows?", answer: 3 },
        { questionText: "Wheels?", answer: 2 },
      ],
    };
    const easier = applyDifficulty(lock, "easy");
    expect(easier).toEqual({ ...lock, digits: 2, questions: lock.questions.slice(0, 2) });
  });

  it("keeps a jigsaw close-up when the preset changes", () => {
    const jigsaw = { type: "jigsaw" as const, pieces: 12 as const, rotation: false, crop: { x: 0.1, y: 0.2, size: 0.5 } };
    expect(applyDifficulty(jigsaw, "hard")).toEqual({ type: "jigsaw", pieces: 16, rotation: true, crop: { x: 0.1, y: 0.2, size: 0.5 } });
  });

  it("pads lock questions when dials are added", () => {
    const lock = withLockDigits({ type: "countingLock", digits: 1, questions: [{ questionText: "Chairs?", answer: 12 }] }, 3);
    expect(lock.questions).toHaveLength(3);
    expect(lock.questions[0].questionText).toBe("Chairs?");
  });
});

describe("hunt factory", () => {
  it("creates a valid six-station draft in the spec's order, every puzzle built", () => {
    const hunt = newHunt("Birthday Treasure Hunt");
    expect(HuntSchema.safeParse(hunt).success).toBe(true);
    expect(hunt.stations.map((s) => s.puzzle.type)).toEqual([...PUZZLE_TYPES]);
    expect(hunt.stations.every((s) => isPuzzleReady(s.puzzle.type))).toBe(true);
    expect(hunt.stations.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(hunt.stations.map((s) => s.key)).size).toBe(6);
  });

  it("slugifies titles safely", () => {
    expect(slugify("Leo's 7th Birthday!!")).toBe("leo-s-7th-birthday");
    expect(slugify("🎉")).toBe("");
  });

  it("duplicates with new ids and keys, cleared media and draft status", () => {
    const source = newHunt("Birthday");
    source.status = "active";
    source.stations[0].clue = { photoUrl: "/p.jpg", audioUrl: "/a.m4a", text: "riddle", showText: true };
    const copy = duplicateHunt(source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.status).toBe("draft");
    expect(copy.stations[0].clue).toEqual({ showText: true, text: "riddle" });
    expect(copy.stations[0].key).not.toBe(source.stations[0].key);
    expect(copy.stations.map((s) => s.puzzle)).toEqual(source.stations.map((s) => s.puzzle));
    expect(HuntSchema.safeParse(copy).success).toBe(true);
  });

  it("drops jigsaw close-ups on duplicate, since the photos are re-shot", () => {
    const source = newHunt("Birthday");
    source.stations[0].puzzle = { type: "jigsaw", pieces: 9, rotation: true, crop: { x: 0.1, y: 0.1, size: 0.4 } };
    expect(duplicateHunt(source).stations[0].puzzle).toEqual({ type: "jigsaw", pieces: 9, rotation: true });
  });

  it("validates a close-up stays inside the photo", () => {
    const hunt = newHunt("Birthday");
    hunt.stations[0].puzzle = { type: "jigsaw", pieces: 12, rotation: false, crop: { x: 0.7, y: 0, size: 0.5 } };
    expect(HuntSchema.safeParse(hunt).success).toBe(false);
    hunt.stations[0].puzzle = { type: "jigsaw", pieces: 12, rotation: false, crop: { x: 0.5, y: 0.5, size: 0.5 } };
    expect(HuntSchema.safeParse(hunt).success).toBe(true);
  });

  it("regenerates every key", () => {
    const hunt = newHunt("Birthday");
    const rekeyed = regenerateKeys(hunt);
    rekeyed.stations.forEach((s, i) => expect(s.key).not.toBe(hunt.stations[i].key));
  });

  it("applies a difficulty preset to every station", () => {
    const hard = setHuntDifficulty(newHunt("Birthday"), "hard");
    expect(hard.difficulty).toBe("hard");
    expect(hard.stations[0].puzzle).toEqual({ type: "jigsaw", pieces: 16, rotation: true });
    expect(hard.stations[1].puzzle).toEqual({ type: "marbleRun", level: 4 });
  });
});

describe("huntProblems", () => {
  it("flags every station of a fresh hunt as missing a clue", () => {
    const problems = huntProblems(newHunt("Birthday"));
    expect(problems.filter((p) => p.includes("add a clue photo"))).toHaveLength(6);
    expect(problems.some((p) => p.includes("isn't built yet"))).toBe(false);
    expect(problems.some((p) => p.includes("jigsaw needs a clue photo"))).toBe(true);
    expect(problems.some((p) => p.includes("question for dial 1"))).toBe(true);
  });

  it("accepts a riddle-only clue when its text is shown", () => {
    const hunt = newHunt("Birthday");
    hunt.stations[1].clue = { text: "I keep things cold and hum all night", showText: true };
    expect(huntProblems(hunt).some((p) => p.startsWith("Station 2"))).toBe(false);
  });

  it("does not accept hidden clue text as a clue", () => {
    const hunt = newHunt("Birthday");
    hunt.stations[1].clue = { text: "hidden", showText: false };
    expect(huntProblems(hunt).some((p) => p.startsWith("Station 2"))).toBe(true);
  });

  it("returns nothing for a complete hunt", () => {
    const hunt = newHunt("Birthday");
    hunt.stations = hunt.stations.map((s) => ({ ...s, clue: { photoUrl: "/p.jpg", showText: false } }));
    const lock = hunt.stations.find((s) => s.puzzle.type === "countingLock")!.puzzle;
    if (lock.type === "countingLock") lock.questions = lock.questions.map((q) => ({ ...q, questionText: "How many?", answer: 3 }));
    expect(huntProblems(hunt)).toEqual([]);
  });

  it("caps single-dial answers at 99 and multi-dial answers at 9", () => {
    const hunt = newHunt("Birthday");
    const lock = hunt.stations.find((s) => s.puzzle.type === "countingLock")!.puzzle;
    if (lock.type === "countingLock") lock.questions[0] = { questionText: "How many?", answer: 12 };
    expect(huntProblems(hunt).some((p) => p.includes("must be 9 or less"))).toBe(true);
  });

  it("blocks going live while a station uses a puzzle that isn't built", () => {
    // Every puzzle is built now; the safeguard stays for any future one.
    PUZZLE_META.marbleRun.ready = false;
    try {
      const hunt = newHunt("Birthday");
      expect(huntProblems(hunt).some((p) => p.includes("Marble Run isn't built yet"))).toBe(true);
    } finally {
      PUZZLE_META.marbleRun.ready = true;
    }
  });

  it("labels the last clue as pointing to the treasure", () => {
    const hunt = newHunt("Birthday");
    expect(clueTargetLabel(hunt.stations[1], 6)).toBe("Clue to find station 3");
    expect(clueTargetLabel(hunt.stations[5], 6)).toBe("Clue to find the treasure");
  });
});
