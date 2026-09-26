"use client";

import { Question } from "@phosphor-icons/react";
import { ScanButton } from "@/components/scan/ScanButton";

/** An unknown station, a stale printed code, or a mistyped link. */
export function InvalidScreen() {
  return (
    <div className="grid min-h-full place-items-center p-8">
      <div className="grid justify-items-center gap-8 text-center">
        <div className="plastic plastic-cobalt is-round grid size-40 place-items-center">
          <Question weight="fill" size={96} />
        </div>
        <h1 className="max-w-[20ch] font-display text-6xl text-balance">Hmm, that&apos;s not a treasure code!</h1>
        <p className="text-2xl font-semibold text-cream/75">Ask a grown-up to check it, or try another one.</p>
        <ScanButton label="Scan again" size="md" color="sunflower" />
      </div>
    </div>
  );
}
