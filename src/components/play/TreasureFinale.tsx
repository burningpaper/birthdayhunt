"use client";

import { ArrowLeft, TreasureChest } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { SpeakerButton } from "@/components/plastic/SpeakerButton";
import { grandFanfare } from "@/lib/audio/sfx";
import { celebrateTreasure } from "./confetti";
import { useVoiceLines } from "./VoiceLinesContext";

/**
 * The finish line. The app can't see the treasure being found, so the child
 * says so: tapping "I found the treasure!" on the last clue opens this, with
 * the biggest celebration in the app and the parent's ending message.
 */
export function TreasureFinale({ message, onClose }: { message?: string; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const voice = useVoiceLines();

  useEffect(() => {
    grandFanfare();
    celebrateTreasure();
    voice.say("finale.found");
  }, [voice]);

  return createPortal(
    <motion.div
      className="toybox fixed inset-0 z-50 grid place-items-center overflow-hidden p-8 text-center text-cream"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label="You found the treasure!"
    >
      <div className="grid justify-items-center gap-8">
        <motion.div
          className="plastic plastic-sunflower is-round grid size-48 place-items-center text-ink"
          initial={{ scale: 0.2, rotate: -20 }}
          animate={reduceMotion ? { scale: 1, rotate: 0 } : { scale: [0.2, 1.15, 1], rotate: [-20, 8, 0], y: [0, -12, 0] }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        >
          <TreasureChest weight="fill" size={120} />
        </motion.div>
        <motion.h1
          className="max-w-[16ch] font-display text-7xl text-balance"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 16 }}
        >
          You found the treasure!
        </motion.h1>
        {message && (
          <motion.p
            className="max-w-[36ch] rounded-[var(--radius-button)] bg-toybox-glow/70 px-8 py-4 text-3xl font-semibold text-balance"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            {message}
          </motion.p>
        )}
        <div className="flex items-center gap-4">
          {voice.has("finale.found") && <SpeakerButton size="lg" color="sunflower" onSpeak={() => voice.say("finale.found")} label="Hear the message again" />}
          <PlasticButton size="md" color="cream" onClick={onClose}>
            <ArrowLeft weight="bold" size={26} />
            Back to the clue
          </PlasticButton>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
