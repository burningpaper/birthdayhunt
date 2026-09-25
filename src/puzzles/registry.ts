import type { ComponentType } from "react";
import type { PuzzleType } from "@/lib/schema";
import { Jigsaw } from "./jigsaw/Jigsaw";
import { Placeholder } from "./Placeholder";
import type { PuzzleProps } from "./types";

/** Puzzle type → component. Real puzzles replace the placeholder one at a time. */
export const PUZZLES: Record<PuzzleType, ComponentType<PuzzleProps>> = {
  jigsaw: Jigsaw,
  marbleRun: Placeholder,
  trainTrack: Placeholder,
  memoryMatch: Placeholder,
  flickGolf: Placeholder,
  countingLock: Placeholder,
};
