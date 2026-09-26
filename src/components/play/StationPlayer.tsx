"use client";

import { ArrowClockwise } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { unlockAudio } from "@/lib/audio/engine";
import { speak } from "@/lib/audio/voice";
import type { ClueView, PlayResponse } from "@/lib/playState";
import { PUZZLE_META } from "@/lib/puzzleMeta";
import { CelebrationScreen } from "./CelebrationScreen";
import { ClueReveal } from "./ClueReveal";
import { IntroScreen } from "./IntroScreen";
import { InvalidScreen } from "./InvalidScreen";
import { NotYetScreen } from "./NotYetScreen";
import { PuzzleStage } from "./PuzzleStage";
import { StationChip } from "./StationChip";

type PlayableResponse = Extract<PlayResponse, { state: "play" }>;

type Props = {
  initial: PlayResponse;
  huntId: string;
  stationKey: string;
  preview: boolean;
};

const CELEBRATION_MS = 2600;

/** Routes a scan to the right screen. The playable path has its own state machine. */
export function StationPlayer({ initial, huntId, stationKey, preview }: Props) {
  switch (initial.state) {
    case "invalid":
      return <InvalidScreen />;
    case "notYet":
      return <NotYetScreen lastEarnedClue={initial.lastEarnedClue} />;
    case "solved":
      return (
        <>
          <StationChip station={initial.station} />
          <ClueReveal clue={initial.clue} />
        </>
      );
    case "play":
      return <PlayableStation response={initial} huntId={huntId} stationKey={stationKey} preview={preview} />;
  }
}

type Phase =
  | { name: "intro" }
  | { name: "puzzle" }
  | { name: "saving" }
  | { name: "saveFailed" }
  | { name: "celebrate"; clue: ClueView }
  | { name: "clue"; clue: ClueView };

/** intro → puzzle → (save) → celebrate → clue */
function PlayableStation({ response, huntId, stationKey, preview }: { response: PlayableResponse } & Omit<Props, "initial">) {
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [stars, setStars] = useState<1 | 2 | 3>(3);

  // On a small screen the play area scrolls; each new phase starts at the top
  // rather than wherever the last one was scrolled to. (The intro is left
  // alone: its autofocused "Tap to start!" scrolls itself into view.)
  useEffect(() => {
    if (phase.name !== "intro") document.querySelector(".play-surface")?.scrollTo({ top: 0 });
  }, [phase.name]);
  const { station, puzzle } = response;
  const meta = PUZZLE_META[puzzle.type];

  const start = () => {
    unlockAudio();
    speak(meta.instruction);
    setPhase({ name: "puzzle" });
  };

  const submitSolve = useCallback(async () => {
    setPhase({ name: "saving" });
    const query = new URLSearchParams({ k: stationKey, ...(preview ? { preview: "1" } : {}) });
    try {
      const res = await fetch(`/api/play/${huntId}/${station.id}/solve?${query}`, { method: "POST" });
      if (!res.ok) throw new Error(`solve returned ${res.status}`);
      const { clue } = (await res.json()) as { clue: ClueView };
      setPhase({ name: "celebrate", clue });
      setTimeout(() => setPhase({ name: "clue", clue }), CELEBRATION_MS);
    } catch (error) {
      console.error("[play] could not save the solve", error);
      setPhase({ name: "saveFailed" });
    }
  }, [huntId, preview, station.id, stationKey]);

  return (
    <>
      <StationChip station={station} preview={preview} />
      <AnimatePresence mode="wait">
        <motion.div
          // "saving" keeps the puzzle mounted, so the finished board stays on screen.
          key={phase.name === "saving" ? "puzzle" : phase.name}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {phase.name === "intro" && <IntroScreen puzzleType={puzzle.type} childName={response.childName} onStart={start} />}

          {(phase.name === "puzzle" || phase.name === "saving") && (
            <PuzzleStage
              puzzle={puzzle}
              difficulty={response.difficulty}
              puzzlePhotoUrl={response.puzzlePhotoUrl}
              onSolved={(earned) => {
                setStars(earned);
                void submitSolve();
              }}
            />
          )}

          {phase.name === "saveFailed" && (
            <div className="grid min-h-full place-items-center p-8 text-center">
              <div className="grid justify-items-center gap-8">
                <h1 className="font-display text-6xl">Oops, the internet hiccuped!</h1>
                <PlasticButton size="lg" color="sunflower" onClick={() => void submitSolve()}>
                  <ArrowClockwise weight="fill" size={40} />
                  Try again
                </PlasticButton>
              </div>
            </div>
          )}

          {phase.name === "celebrate" && <CelebrationScreen puzzleType={puzzle.type} isFinal={phase.clue.isFinal} stars={stars} />}
          {phase.name === "clue" && <ClueReveal clue={phase.clue} />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
