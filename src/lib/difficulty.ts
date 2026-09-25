import type { Difficulty, LockQuestion, PuzzleConfig, PuzzleType } from "./schema";

/**
 * One table drives every puzzle's difficulty (spec §4). Medium is the age-7
 * default; Easy and Hard shift each setting one step down or up.
 */
const PRESETS = {
  jigsaw: {
    easy: { pieces: 9, rotation: false },
    medium: { pieces: 12, rotation: false },
    hard: { pieces: 16, rotation: true },
  },
  marbleRun: { easy: { level: 2 }, medium: { level: 3 }, hard: { level: 4 } },
  trainTrack: { easy: { gridSize: 4 }, medium: { gridSize: 5 }, hard: { gridSize: 6 } },
  memoryMatch: { easy: { pairs: 8 }, medium: { pairs: 10 }, hard: { pairs: 12 } },
  flickGolf: { easy: { holes: 2 }, medium: { holes: 3 }, hard: { holes: 4 } },
  countingLock: { easy: { digits: 2 }, medium: { digits: 3 }, hard: { digits: 3 } },
} as const;

/**
 * The spec's order is Jigsaw, Marble Run, Train Track, Memory Match, Flick
 * Golf, Counting Lock. Until the two physics puzzles are built, new hunts
 * use six stations of the four that are (see PUZZLE_META.ready).
 */
export const DEFAULT_PUZZLE_ORDER: PuzzleType[] = [
  "jigsaw",
  "trainTrack",
  "memoryMatch",
  "countingLock",
  "trainTrack",
  "memoryMatch",
];

function blankQuestion(): LockQuestion {
  return { questionText: "", answer: 0 };
}

/** Pad or trim lock questions so there is exactly one per dial. */
function fitQuestions(questions: LockQuestion[], digits: number): LockQuestion[] {
  const fitted = questions.slice(0, digits);
  while (fitted.length < digits) fitted.push(blankQuestion());
  return fitted;
}

/** A fresh puzzle config of the given type at the given difficulty. */
export function defaultPuzzle(type: PuzzleType, difficulty: Difficulty): PuzzleConfig {
  switch (type) {
    case "jigsaw":
      return { type, ...PRESETS.jigsaw[difficulty] };
    case "marbleRun":
      return { type, ...PRESETS.marbleRun[difficulty] };
    case "trainTrack":
      return { type, ...PRESETS.trainTrack[difficulty] };
    case "memoryMatch":
      return { type, ...PRESETS.memoryMatch[difficulty] };
    case "flickGolf":
      return { type, ...PRESETS.flickGolf[difficulty] };
    case "countingLock": {
      const { digits } = PRESETS.countingLock[difficulty];
      return { type, digits, questions: fitQuestions([], digits) };
    }
  }
}

/**
 * Re-apply a difficulty preset to an existing puzzle, keeping the parent's
 * own content (memory photos, lock questions) intact.
 */
export function applyDifficulty(puzzle: PuzzleConfig, difficulty: Difficulty): PuzzleConfig {
  const fresh = defaultPuzzle(puzzle.type, difficulty);
  if (puzzle.type === "memoryMatch" && fresh.type === "memoryMatch") {
    return { ...fresh, photoUrls: puzzle.photoUrls };
  }
  if (puzzle.type === "countingLock" && fresh.type === "countingLock") {
    return { ...fresh, questions: fitQuestions(puzzle.questions, fresh.digits) };
  }
  return fresh;
}

/** Change the number of lock dials, keeping existing questions where possible. */
export function withLockDigits(puzzle: PuzzleConfig & { type: "countingLock" }, digits: 1 | 2 | 3) {
  return { ...puzzle, digits, questions: fitQuestions(puzzle.questions, digits) };
}
