"use client";

import { Play, SpeakerHigh } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { QrScanner } from "@/components/scan/QrScanner";
import { useHydrated } from "@/components/useHydrated";
import { unlockAudio } from "@/lib/audio/engine";
import { playRecordingToEnd, stopTalking } from "@/lib/audio/voice";

type Phase = "ready" | "playing" | "scanning";

/**
 * The front page while a hunt is live: one big red button. Pressing it plays
 * the parent's welcome message, then opens the scanner for the first code.
 * Pressing it again mid-message skips straight to the scanner; with no
 * message recorded, it goes straight there.
 */
export function StartScreen({ welcomeUrl }: { welcomeUrl?: string }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const hydrated = useHydrated();
  const reduceMotion = useReducedMotion();

  async function press() {
    if (phase === "playing") {
      stopTalking(); // ends the message early; the scanner opens below
      return;
    }
    unlockAudio();
    if (welcomeUrl) {
      setPhase("playing");
      await playRecordingToEnd(welcomeUrl);
    }
    setPhase("scanning");
  }

  const playing = phase === "playing";
  return (
    <main className="toybox grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <h1 className="sr-only">Treasure hunt</h1>
      <div className="relative grid place-items-center">
        {/* A slow, glowing breath behind the button invites a tap (the button itself stays still). */}
        {phase === "ready" && !reduceMotion && (
          <motion.span
            aria-hidden
            className="absolute size-72 rounded-full bg-tomato/45 blur-2xl"
            animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {/* Rings rippling out while the message plays. */}
        {playing &&
          !reduceMotion &&
          [0, 0.6, 1.2].map((delay) => (
            <motion.span
              key={delay}
              aria-hidden
              className="absolute size-72 rounded-full border-8 border-tomato/60"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 1.8, delay, repeat: Infinity, ease: "easeOut" }}
            />
          ))}
        <motion.button
          type="button"
          onClick={() => void press()}
          aria-label={playing ? "Skip to the scanner" : "Start the treasure hunt"}
          data-phase={phase}
          className="plastic plastic-tomato is-round is-pressable relative grid size-72 place-items-center text-cream focus-visible:outline-8 focus-visible:outline-offset-8 focus-visible:outline-sunflower"
          whileTap={{ scale: 0.94 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={playing ? "speaker" : "play"}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="grid place-items-center"
            >
              {playing ? <SpeakerHigh weight="fill" size={128} /> : <Play weight="fill" size={136} className="translate-x-2" />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Portalled to <body>, like every scanner: nothing transformed may trap its fixed overlay. */}
      {hydrated &&
        createPortal(<AnimatePresence>{phase === "scanning" && <QrScanner onClose={() => setPhase("ready")} />}</AnimatePresence>, document.body)}
    </main>
  );
}
