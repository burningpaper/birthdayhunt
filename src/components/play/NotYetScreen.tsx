"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useState } from "react";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { ScanButton } from "@/components/scan/ScanButton";
import { unlockAudio } from "@/lib/audio/engine";
import type { ClueView } from "@/lib/playState";
import { ClueReveal } from "./ClueReveal";
import { SpeakerButton } from "@/components/plastic/SpeakerButton";
import { useVoiceLines } from "./VoiceLinesContext";

/**
 * Scanned a station too early (spec §5.2). Say so gently, then replay the
 * clue they already earned. Nothing about the scanned station is known here:
 * the server never sent it.
 */
export function NotYetScreen({ lastEarnedClue }: { lastEarnedClue?: ClueView }) {
  const [showClue, setShowClue] = useState(false);
  const voice = useVoiceLines();

  if (showClue && lastEarnedClue) return <ClueReveal clue={lastEarnedClue} />;

  const line = lastEarnedClue ? "notYet.anotherClue" : "notYet.firstCode";

  return (
    <div className="grid min-h-full place-items-center p-8">
      <div className="grid justify-items-center gap-8 text-center">
        <motion.div
          initial={{ rotate: -20, scale: 0.7 }}
          animate={{ rotate: [-20, 12, -6, 0], scale: 1 }}
          transition={{ duration: 0.9 }}
          className="plastic plastic-tangerine is-round grid size-40 place-items-center"
        >
          <MagnifyingGlass weight="fill" size={92} />
        </motion.div>
        <h1 className="font-display text-7xl">Not yet!</h1>
        <div className="flex items-center gap-4">
          <p className="max-w-[30ch] text-3xl font-semibold text-balance text-cream/85">
            {lastEarnedClue ? "There's another clue to find first." : "Find the very first treasure code."}
          </p>
          {voice.has(line) && (
            <SpeakerButton
              onSpeak={() => {
                unlockAudio();
                voice.say(line);
              }}
            />
          )}
        </div>
        {lastEarnedClue && (
          <PlasticButton
            size="lg"
            color="sunflower"
            onClick={() => {
              unlockAudio();
              setShowClue(true);
            }}
          >
            Show my clue
          </PlasticButton>
        )}
        <ScanButton label="Scan a different code" size="md" color="cobalt" />
      </div>
    </div>
  );
}
