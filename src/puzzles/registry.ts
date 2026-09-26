import type { ComponentType } from "react";
import type { PuzzleType } from "@/lib/schema";
import { FlickGolf } from "./golf/FlickGolf";
import { Jigsaw } from "./jigsaw/Jigsaw";
import { CountingLock } from "./lock/CountingLock";
import { MarbleRun } from "./marble/MarbleRun";
import { MemoryMatch } from "./memory/MemoryMatch";
import { TrainTrack } from "./track/TrainTrack";
import type { PuzzleProps } from "./types";

/** Puzzle type → component. */
export const PUZZLES: Record<PuzzleType, ComponentType<PuzzleProps>> = {
  jigsaw: Jigsaw,
  marbleRun: MarbleRun,
  trainTrack: TrainTrack,
  memoryMatch: MemoryMatch,
  flickGolf: FlickGolf,
  countingLock: CountingLock,
};
