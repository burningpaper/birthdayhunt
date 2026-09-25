"use client";

import { motion } from "motion/react";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { PuzzleIcon } from "@/components/PuzzleIcon";
import { PUZZLE_META } from "@/lib/puzzleMeta";
import type { PuzzleType } from "@/lib/schema";

type Props = { puzzleType: PuzzleType; childName?: string; onStart: () => void };

const pop = { type: "spring", stiffness: 260, damping: 20 } as const;

/**
 * The first thing a scan shows. Its big button is also the iOS audio unlock:
 * the tap that starts the puzzle is the gesture that lets the app talk.
 */
export function IntroScreen({ puzzleType, childName, onStart }: Props) {
  const meta = PUZZLE_META[puzzleType];
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="grid justify-items-center gap-10 text-center">
        <motion.div
          initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={pop}
          className={`plastic plastic-${meta.color} is-panel grid size-44 place-items-center`}
        >
          <PuzzleIcon type={puzzleType} size={104} />
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...pop, delay: 0.08 }}>
          <p className="text-2xl font-semibold text-cream/75">{childName ? `You found one, ${childName}!` : "You found one!"}</p>
          <h1 className="font-display text-7xl text-balance">{meta.name}</h1>
        </motion.div>

        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...pop, delay: 0.18 }}>
          <PlasticButton size="xl" color="sunflower" onClick={onStart} autoFocus>
            Tap to start!
          </PlasticButton>
        </motion.div>
      </div>
    </div>
  );
}
