import type { ComponentType } from "react";
import type { PuzzleType } from "@/lib/schema";
import { Placeholder } from "./Placeholder";
import type { PuzzleProps } from "./types";

/** Puzzle type → component. Real puzzles replace the placeholder one at a time. */
export const PUZZLES: Record<PuzzleType, ComponentType<PuzzleProps>> = {
  jigsaw: Placeholder,
  marbleRun: Placeholder,
  trainTrack: Placeholder,
  memoryMatch: Placeholder,
  flickGolf: Placeholder,
  countingLock: Placeholder,
};
