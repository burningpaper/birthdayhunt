"use client";

import { Lightbulb } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { SpeakerButton } from "@/components/plastic/SpeakerButton";
import { initialHintState, isHintReady, recordFailure, recordProgress, spendHint, starsFor, type HintState } from "@/lib/hints";
import { PUZZLE_META } from "@/lib/puzzleMeta";
import type { Difficulty, PuzzleConfig } from "@/lib/schema";
import { PUZZLES } from "@/puzzles/registry";
import { useVoiceLines } from "./VoiceLinesContext";

type Props = {
  puzzle: PuzzleConfig;
  difficulty: Difficulty;
  puzzlePhotoUrl?: string;
  /** Reports the star rating (1 to 3) when the puzzle is solved. */
  onSolved: (stars: 1 | 2 | 3) => void;
};

const HINT_CHECK_MS = 5000;

/**
 * Everything around a puzzle: the instruction line with its speaker, and the
 * hint button that lights up when the child seems stuck (lib/hints.ts).
 */
export function PuzzleStage({ puzzle, difficulty, puzzlePhotoUrl, onSolved }: Props) {
  const meta = PUZZLE_META[puzzle.type];
  const Puzzle = PUZZLES[puzzle.type];
  const voice = useVoiceLines();
  const instruction = `instruction.${puzzle.type}` as const;
  const hints = useRef<HintState>(initialHintState(0));
  const [hintReady, setHintReady] = useState(false);
  const [hintRequest, setHintRequest] = useState(0);
  const [solved, setSolved] = useState(false);

  // The idle rule needs a clock; failures are checked the moment they happen.
  useEffect(() => {
    hints.current = initialHintState(Date.now());
    const timer = setInterval(() => setHintReady(isHintReady(hints.current, Date.now())), HINT_CHECK_MS);
    return () => clearInterval(timer);
  }, []);

  const update = (next: HintState) => {
    hints.current = next;
    setHintReady(isHintReady(next, Date.now()));
  };

  return (
    <div className="relative h-full pt-24">
      <div className="absolute top-5 right-5 z-10 flex items-center gap-4">
        <p className="max-w-[30ch] text-right text-2xl font-semibold text-balance">{meta.instruction}</p>
        {voice.has(instruction) && <SpeakerButton onSpeak={() => voice.say(instruction)} />}
      </div>

      <Puzzle
        config={puzzle}
        difficulty={difficulty}
        cluePhotoUrl={puzzlePhotoUrl}
        hintRequest={hintRequest}
        onAttemptFailed={() => update(recordFailure(hints.current))}
        onProgress={() => update(recordProgress(hints.current, Date.now()))}
        onSolved={() => {
          if (solved) return;
          setSolved(true);
          onSolved(starsFor(hints.current));
        }}
      />

      <AnimatePresence>
        {hintReady && !solved && (
          <motion.div
            className="absolute bottom-6 left-6 z-20"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 16 }}
          >
            <PlasticButton
              round
              size="lg"
              color="sunflower"
              className="hint-ready"
              aria-label="Show a hint"
              onClick={() => {
                update(spendHint(hints.current, Date.now()));
                setHintRequest((n) => n + 1);
              }}
            >
              <Lightbulb weight="fill" size={44} />
            </PlasticButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
