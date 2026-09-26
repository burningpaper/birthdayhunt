"use client";

import { Play } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { LOOK_SAMPLE } from "@/puzzles/marble3d/levels";
import { PieceIcon3d } from "@/puzzles/marble3d/PieceIcon3d";

const MarbleScene = dynamic(() => import("@/puzzles/marble3d/Scene").then((m) => m.MarbleScene), { ssr: false });

/** Stage M1 look prototype: a still frame of a level, laid out like a station. Removed when Marble Run 3D ships. */
export function MarbleLab() {
  const level = LOOK_SAMPLE;
  const placed = [level.solution[0]];
  return (
    <main className="toybox fixed inset-0 flex flex-col text-cream">
      <header className="flex h-20 shrink-0 items-center justify-end px-6">
        <p className="font-display text-3xl">Build a path so the marble lands in the bucket!</p>
      </header>
      <div className="relative min-h-0 flex-1" data-testid="marble-scene">
        <MarbleScene level={level} placed={placed} marble={null} hoverCell={{ col: 1, row: 2 }} />
      </div>
      <div className="flex h-[120px] shrink-0 items-center justify-between gap-4 px-6">
        <div className="flex flex-1 items-center gap-3 rounded-[var(--radius-panel)] bg-toybox-glow/60 px-4 py-2">
          {level.tray.slice(0, 1).concat(["straight"]).map((type, i) => (
            <div key={i} className="plastic plastic-cream is-tile grid size-20 place-items-center">
              <PieceIcon3d type={type} size={64} />
            </div>
          ))}
        </div>
        <PlasticButton size="lg" color="grass">
          <Play weight="fill" size={36} />
          GO!
        </PlasticButton>
      </div>
    </main>
  );
}
