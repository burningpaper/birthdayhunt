"use client";

import { CaretDown, CaretUp, Lightbulb } from "@phosphor-icons/react";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { SpeakerButton } from "@/components/plastic/SpeakerButton";
import { PuzzleIcon } from "@/components/PuzzleIcon";
import { unlockAudio } from "@/lib/audio/engine";
import { boing, fanfare, snap } from "@/lib/audio/sfx";
import { PUZZLE_META } from "@/lib/puzzleMeta";
import { PUZZLE_TYPES } from "@/lib/schema";

export function Styleguide() {
  return (
    <main className="toybox min-h-dvh px-6 py-12" onPointerDown={unlockAudio}>
      <div className="mx-auto grid max-w-5xl gap-14">
        <header className="grid gap-3">
          <h1 className="font-display text-6xl">Toybox Plastic</h1>
          <p className="max-w-[60ch] text-xl text-cream/75">Every control is a piece of shiny plastic. Press things: they sink, and they click.</p>
        </header>

        <section className="grid gap-6">
          <h2 className="font-display text-3xl">One plastic per puzzle</h2>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {PUZZLE_TYPES.map((type) => {
              const meta = PUZZLE_META[type];
              return (
                <PlasticButton key={type} color={meta.color} size="lg" className="w-full !justify-start">
                  <PuzzleIcon type={type} size={40} />
                  <span className="text-2xl">{meta.name}</span>
                </PlasticButton>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6">
          <h2 className="font-display text-3xl">Buttons</h2>
          <div className="flex flex-wrap items-end gap-6">
            <PlasticButton size="xl" color="sunflower">Tap to start!</PlasticButton>
            <PlasticButton size="lg" color="grass">GO!</PlasticButton>
            <PlasticButton size="md" color="bubblegum">Open!</PlasticButton>
            <PlasticButton size="sm" color="cobalt">Small</PlasticButton>
            <PlasticButton size="md" color="cobalt" disabled>Disabled</PlasticButton>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <SpeakerButton size="xl" color="sunflower" onSpeak={() => {}} />
            <SpeakerButton onSpeak={() => {}} />
            <PlasticButton round size="lg" color="bubblegum" aria-label="Up"><CaretUp weight="fill" size={40} /></PlasticButton>
            <PlasticButton round size="lg" color="bubblegum" aria-label="Down"><CaretDown weight="fill" size={40} /></PlasticButton>
            <PlasticButton round size="lg" color="sunflower" aria-label="Hint" className="hint-ready"><Lightbulb weight="fill" size={40} /></PlasticButton>
          </div>
        </section>

        <section className="grid gap-6">
          <h2 className="font-display text-3xl">Sounds</h2>
          <div className="flex flex-wrap gap-4">
            <PlasticButton size="sm" color="cream" clicky={false} onClick={snap}>Snap</PlasticButton>
            <PlasticButton size="sm" color="cream" clicky={false} onClick={boing}>Not quite</PlasticButton>
            <PlasticButton size="sm" color="cream" clicky={false} onClick={fanfare}>Solved</PlasticButton>
          </div>
        </section>

        <section className="grid gap-6">
          <h2 className="font-display text-3xl">Type</h2>
          <p className="font-display text-7xl">You did it!</p>
          <p className="text-3xl font-semibold">Flip two cards. Find all the pairs!</p>
        </section>
      </div>
    </main>
  );
}
