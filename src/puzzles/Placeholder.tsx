"use client";

import { PlasticButton } from "@/components/plastic/PlasticButton";
import { PUZZLE_META } from "@/lib/puzzleMeta";
import type { PuzzleProps } from "./types";

/**
 * Stands in for any puzzle not built yet, so a whole hunt is playable end to
 * end from Stage 1. Each real puzzle replaces its entry in the registry.
 */
export function Placeholder({ config, onSolved }: PuzzleProps) {
  const meta = PUZZLE_META[config.type];
  return (
    <div className="grid min-h-full place-items-center">
      <div className="grid justify-items-center gap-8 text-center">
        <p className="font-display text-4xl text-cream/80">{meta.name} is coming soon</p>
        <PlasticButton size="xl" color={meta.color} onClick={onSolved}>
          Tap to solve
        </PlasticButton>
      </div>
    </div>
  );
}
