import type { PuzzleType } from "./schema";

/** The six plastics from DESIGN.md. */
export type PlasticColor = "tomato" | "cobalt" | "grass" | "sunflower" | "tangerine" | "bubblegum" | "cream";

export type PuzzleMeta = {
  name: string;
  color: PlasticColor;
  /** Raw hex, for canvas work and confetti. */
  hex: string;
  /** One line a seven-year-old can read. Also what gets spoken. */
  instruction: string;
};

/** Each puzzle owns one plastic colour, so a station has an identity on sight. */
export const PUZZLE_META: Record<PuzzleType, PuzzleMeta> = {
  jigsaw: { name: "Jigsaw", color: "tomato", hex: "#F0453A", instruction: "Drag the pieces to build the picture!" },
  marbleRun: { name: "Marble Run", color: "cobalt", hex: "#2F6BEA", instruction: "Build a path so the marble lands in the cup!" },
  trainTrack: { name: "Train Track", color: "grass", hex: "#22A94F", instruction: "Tap the tracks to turn them. Get the train home!" },
  memoryMatch: { name: "Memory Match", color: "sunflower", hex: "#FFC21A", instruction: "Flip two cards. Find all the pairs!" },
  flickGolf: { name: "Flick Golf", color: "tangerine", hex: "#FF8A1F", instruction: "Pull back and let go to hit the ball in the hole!" },
  countingLock: { name: "Counting Lock", color: "bubblegum", hex: "#F0508F", instruction: "Count things around the house to open the lock!" },
};

export const ALL_PLASTIC_HEXES = Object.values(PUZZLE_META).map((m) => m.hex);
