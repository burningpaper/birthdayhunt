import type { Difficulty, PuzzleConfig } from "@/lib/schema";

/** The contract every puzzle component implements (spec §6). */
export type PuzzleProps<C extends PuzzleConfig = PuzzleConfig> = {
  config: C;
  difficulty: Difficulty;
  /** Only the jigsaw receives this before solving; it is the puzzle image. */
  cluePhotoUrl?: string;
  onSolved: () => void;
  /** Drives the hint timer: call on every miss (wrong pair, marble off-screen...). */
  onAttemptFailed?: () => void;
};
