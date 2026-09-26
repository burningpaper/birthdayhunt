"use client";

import { Wrench, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { useHydrated } from "@/components/useHydrated";
import type { PuzzleConfig } from "@/lib/schema";
import { MarbleRun } from "./MarbleRun";

/**
 * The marble run's free-build extra (spec §6.2): after solving, keep
 * playing on the same course with two of every piece. The clue is already
 * revealed, so this never holds up the hunt.
 */
export function KeepBuilding({ config }: { config: PuzzleConfig }) {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  const noop = () => {};
  return (
    <>
      <PlasticButton size="md" color="cobalt" onClick={() => setOpen(true)}>
        <Wrench weight="fill" size={28} />
        Keep building!
      </PlasticButton>
      {hydrated &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                className="toybox play-surface fixed inset-0 z-50 overflow-hidden pt-24"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                role="dialog"
                aria-modal="true"
                aria-label="Free build"
              >
                <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-4 p-6">
                  <p className="font-display text-3xl">Free build: make any run you like!</p>
                  <PlasticButton round size="md" color="cream" aria-label="Back to the clue" onClick={() => setOpen(false)}>
                    <X weight="bold" size={30} />
                  </PlasticButton>
                </div>
                <MarbleRun config={config} difficulty="medium" hintRequest={0} onSolved={noop} sandbox />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
