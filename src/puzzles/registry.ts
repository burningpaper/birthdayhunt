import type { ComponentType } from "react";
import type { PuzzleType } from "@/lib/schema";
import { FlickGolf } from "./golf/FlickGolf";
import { Jigsaw } from "./jigsaw/Jigsaw";
import { CountingLock } from "./lock/CountingLock";
import { MarbleRun3d } from "./marble3d/MarbleRun3d";
import { MemoryMatch } from "./memory/MemoryMatch";
import { TrainTrack } from "./track/TrainTrack";
import type { PuzzleProps } from "./types";

/** Puzzle type → component. */
export const PUZZLES: Record<PuzzleType, ComponentType<PuzzleProps>> = {
  jigsaw: Jigsaw,
  marbleRun: MarbleRun3d,
  trainTrack: TrainTrack,
  memoryMatch: MemoryMatch,
  flickGolf: FlickGolf,
  countingLock: CountingLock,
};
