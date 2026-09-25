import type { Difficulty, PuzzleConfig } from "@/lib/schema";

/** The contract every puzzle component implements (spec §6). */
export type PuzzleProps<C extends PuzzleConfig = PuzzleConfig> = {
  config: C;
  difficulty: Difficulty;
  /** Only the jigsaw receives this before solving; it is the puzzle image. */
  cluePhotoUrl?: string;
  onSolved: () => void;
  /** Call on every miss (wrong pair, wrong combination...). Drives the hint button. */
  onAttemptFailed?: () => void;
  /** Call when the child gets closer (a piece snaps, a pair matches). Resets the idle clock. */
  onProgress?: () => void;
  /** Goes up by one each time the child taps the hint button. Show the puzzle's hint when it changes. */
  hintRequest: number;
};
