"use client";

/* eslint-disable @next/next/no-img-element -- clue photos come from Blob or local uploads at runtime */
import { MagnifyingGlass, TreasureChest } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect } from "react";
import { SpeakerButton } from "@/components/plastic/SpeakerButton";
import { ScanButton } from "@/components/scan/ScanButton";
import { playRecording, speak } from "@/lib/audio/voice";
import type { ClueView } from "@/lib/playState";

type Props = {
  clue: ClueView;
  /** Play the voice clue as soon as the screen appears. */
  autoPlay?: boolean;
};

/**
 * The payoff (spec §5.4): the photo of the next hiding spot, the parent's
 * voice, and a nudge to go looking. There's no "next" button because the
 * next step happens with feet, not fingers.
 */
export function ClueReveal({ clue, autoPlay = true }: Props) {
  const reduceMotion = useReducedMotion();
  const hasPhoto = Boolean(clue.photoUrl);
  const findLine = clue.isFinal ? "Go find the treasure!" : "Go find it!";

  const hear = useCallback(() => {
    if (clue.audioUrl) void playRecording(clue.audioUrl);
    else speak(clue.text ? `${clue.text}. ${findLine}` : findLine);
  }, [clue.audioUrl, clue.text, findLine]);

  useEffect(() => {
    if (autoPlay) hear();
  }, [autoPlay, hear]);

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 24 }}
      className="relative h-full"
    >
      {hasPhoto ? <CluePhoto url={clue.photoUrl!} zoom={!reduceMotion} /> : <RiddleCard text={clue.text} />}

      {clue.isFinal && (
        <div className="absolute inset-x-0 top-6 z-10 grid justify-items-center gap-3 px-8 text-center">
          <div className="plastic plastic-sunflower flex items-center gap-3 px-6 py-3 font-display text-4xl">
            <TreasureChest weight="fill" size={44} />
            Last clue: find the treasure!
          </div>
          {clue.treasureMessage && (
            <p className="max-w-[40ch] rounded-[var(--radius-button)] bg-toybox/80 px-6 py-3 text-2xl font-semibold text-balance">
              {clue.treasureMessage}
            </p>
          )}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-6 bg-gradient-to-t from-toybox/90 via-toybox/50 to-transparent p-6 pt-24">
        <div className="grid gap-3">
          {hasPhoto && clue.text && (
            <p className="max-w-[28ch] font-display text-5xl text-balance drop-shadow-[0_3px_0_rgb(8_14_36_/_0.7)]">
              {clue.text}
            </p>
          )}
          <div className="flex items-center gap-3 text-3xl font-bold text-cream/90">
            <MagnifyingGlass weight="fill" size={40} className="text-sunflower" />
            {findLine}
          </div>
        </div>
        <div className="flex items-end gap-4">
          {!clue.isFinal && <ScanButton label="Scan the next code" size="md" color="cobalt" />}
          <SpeakerButton size="xl" color="sunflower" onSpeak={hear} label="Hear the clue again" />
        </div>
      </div>
    </motion.div>
  );
}

/** Contain the photo (odd angles matter) over a blurred copy that fills the screen. */
function CluePhoto({ url, zoom }: { url: string; zoom: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <img src={url} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl" />
      <motion.img
        src={url}
        alt="A photo of where the next clue is hiding"
        draggable={false}
        initial={{ scale: 1 }}
        animate={zoom ? { scale: 1.08 } : undefined}
        transition={{ duration: 9, ease: "easeOut" }}
        className="absolute inset-0 size-full object-contain"
      />
    </div>
  );
}

/** A riddle-only clue: the words are the picture. */
function RiddleCard({ text }: { text?: string }) {
  return (
    <div className="grid h-full place-items-center p-10 pb-40">
      <motion.div
        initial={{ rotate: -4, scale: 0.9 }}
        animate={{ rotate: -2, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="plastic plastic-cream is-panel w-full max-w-3xl px-12 py-10 text-center"
      >
        <p className="font-display text-6xl leading-tight text-balance text-ink">{text ?? "Listen to the clue!"}</p>
      </motion.div>
    </div>
  );
}
