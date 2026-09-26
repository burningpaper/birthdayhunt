"use client";

import { Sparkle, Star } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useEffect } from "react";
import { fanfare, grandFanfare } from "@/lib/audio/sfx";
import { speak } from "@/lib/audio/voice";
import { PUZZLE_META } from "@/lib/puzzleMeta";
import type { PuzzleType } from "@/lib/schema";
import { celebrate, celebrateTreasure } from "./confetti";

type Props = { puzzleType: PuzzleType; isFinal: boolean; stars?: 1 | 2 | 3 };

/** Confetti, fanfare and a spoken "You did it!" before the clue slides in. */
export function CelebrationScreen({ puzzleType, isFinal, stars = 3 }: Props) {
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
    <div className="grid min-h-full place-items-center p-8">
      <motion.div
        initial={{ scale: 0.3, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 14 }}
        className="grid justify-items-center gap-6 text-center"
      >
        <Sparkle weight="fill" size={96} className="text-sunflower" />
        <h1 className="font-display text-8xl text-balance drop-shadow-[0_6px_0_rgb(8_14_36_/_0.5)]">{line}</h1>
        <div className="flex items-end gap-4" aria-label={`${stars} out of 3 stars`}>
          {[1, 2, 3].map((n) => (
            <motion.span
              key={n}
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: n === 2 ? 1.25 : 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 12, delay: 0.35 + n * 0.18 }}
            >
              <Star
                weight="fill"
                size={72}
                className={n <= stars ? "text-sunflower drop-shadow-[0_5px_0_#B8860B]" : "text-cream/15"}
              />
            </motion.span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
