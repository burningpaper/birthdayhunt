"use client";

import confetti from "canvas-confetti";
import { ALL_PLASTIC_HEXES } from "@/lib/puzzleMeta";

/** A burst in the station's own colour, with a little of every other plastic mixed in. */
export function celebrate(stationHex: string) {
  const colors = [stationHex, stationHex, "#FFF7E8", ...ALL_PLASTIC_HEXES];
  const base = { colors, disableForReducedMotion: true, scalar: 1.3, ticks: 260 };
  void confetti({ ...base, particleCount: 90, spread: 70, origin: { x: 0.25, y: 0.75 }, angle: 60 });
  void confetti({ ...base, particleCount: 90, spread: 70, origin: { x: 0.75, y: 0.75 }, angle: 120 });
}

/** The finale: waves of confetti from both sides for three seconds. */
export function celebrateTreasure() {
  const end = Date.now() + 3000;
  const base = { colors: ["#FFC21A", "#FFF7E8", ...ALL_PLASTIC_HEXES], disableForReducedMotion: true, scalar: 1.4 };
  (function frame() {
    void confetti({ ...base, particleCount: 7, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
    void confetti({ ...base, particleCount: 7, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
