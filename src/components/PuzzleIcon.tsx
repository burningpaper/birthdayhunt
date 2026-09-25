"use client";

import { Cards, Golf, LockKey, Path, PuzzlePiece, Train, type IconProps } from "@phosphor-icons/react";
import type { PuzzleType } from "@/lib/schema";

const ICONS = {
  jigsaw: PuzzlePiece,
  marbleRun: Path,
  trainTrack: Train,
  memoryMatch: Cards,
  flickGolf: Golf,
  countingLock: LockKey,
} satisfies Record<PuzzleType, unknown>;

export function PuzzleIcon({ type, ...props }: IconProps & { type: PuzzleType }) {
  const Icon = ICONS[type];
  return <Icon weight="fill" {...props} />;
}
