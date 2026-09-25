"use client";

import { Sparkle } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useEffect } from "react";
import { fanfare, grandFanfare } from "@/lib/audio/sfx";
import { speak } from "@/lib/audio/voice";
import { PUZZLE_META } from "@/lib/puzzleMeta";
import type { PuzzleType } from "@/lib/schema";
import { celebrate, celebrateTreasure } from "./confetti";

type Props = { puzzleType: PuzzleType; isFinal: boolean };

/** Confetti, fanfare and a spoken "You did it!" before the clue slides in. */
export function CelebrationScreen({ puzzleType, isFinal }: Props) {
  const meta = PUZZLE_META[puzzleType];
  const line = isFinal ? "You solved every puzzle!" : "You did it!";

  useEffect(() => {
    if (isFinal) {
      grandFanfare();
      celebrateTreasure();
    } else {
      fanfare();
      celebrate(meta.hex);
    }
    speak(line);
  }, [isFinal, meta.hex, line]);

  return (
    <div className="grid h-full place-items-center p-8">
      <motion.div
        initial={{ scale: 0.3, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 14 }}
        className="grid justify-items-center gap-6 text-center"
      >
        <Sparkle weight="fill" size={96} className="text-sunflower" />
        <h1 className="font-display text-8xl text-balance drop-shadow-[0_6px_0_rgb(8_14_36_/_0.5)]">{line}</h1>
      </motion.div>
    </div>
  );
}
