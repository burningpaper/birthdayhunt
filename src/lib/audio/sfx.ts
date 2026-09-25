"use client";

import { audioContext } from "./engine";

/**
 * Synthesized sound effects: no files to download, and they start instantly.
 * Each is a few oscillator notes with a fast attack and a soft decay, tuned
 * to sound like hard plastic rather than a beep.
 */

type Note = { freq: number; at: number; length: number; type?: OscillatorType; volume?: number; slideTo?: number };

function play(notes: Note[]) {
  const ctx = audioContext();
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + note.at;
    const end = start + note.length;
    const peak = note.volume ?? 0.18;

    osc.type = note.type ?? "triangle";
    osc.frequency.setValueAtTime(note.freq, start);
    if (note.slideTo) osc.frequency.exponentialRampToValueAtTime(note.slideTo, end);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

/** A short hollow knock: every plastic button press. */
export function tock() {
  play([
    { freq: 520, slideTo: 260, at: 0, length: 0.07, type: "sine", volume: 0.3 },
    { freq: 1400, at: 0, length: 0.025, type: "triangle", volume: 0.06 },
  ]);
}

/** A rising chirp: something snapped into place. */
export function snap() {
  play([
    { freq: 660, slideTo: 1320, at: 0, length: 0.09, type: "triangle", volume: 0.2 },
    { freq: 1760, at: 0.06, length: 0.08, type: "sine", volume: 0.1 },
  ]);
}

/** A soft low wobble for "not quite": never a buzzer. */
export function boing() {
  play([{ freq: 220, slideTo: 150, at: 0, length: 0.22, type: "sine", volume: 0.25 }]);
}

/** Four rising notes and a sparkle: puzzle solved. */
export function fanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  play([
    ...notes.map((freq, i) => ({ freq, at: i * 0.11, length: 0.28, type: "triangle" as const, volume: 0.2 })),
    { freq: 2093, at: 0.44, length: 0.5, type: "sine", volume: 0.08 },
  ]);
}

/** The finale: a longer, grander run. */
export function grandFanfare() {
  const run = [392, 523.25, 659.25, 783.99, 1046.5, 1318.5];
  play([
    ...run.map((freq, i) => ({ freq, at: i * 0.1, length: 0.35, type: "triangle" as const, volume: 0.2 })),
    { freq: 1046.5, at: 0.7, length: 1.1, type: "triangle", volume: 0.18 },
    { freq: 1318.5, at: 0.7, length: 1.1, type: "triangle", volume: 0.14 },
    { freq: 1568, at: 0.7, length: 1.1, type: "triangle", volume: 0.12 },
  ]);
}

/** A quick metallic rattle: a padlock that stays shut. Playful, not a buzzer. */
export function rattle() {
  play([0, 0.06, 0.12, 0.18].map((at, i) => ({ freq: i % 2 ? 1250 : 1050, slideTo: 700, at, length: 0.05, type: "square" as const, volume: 0.05 })));
}

/** The lock springs open. */
export function unlock() {
  play([
    { freq: 300, slideTo: 900, at: 0, length: 0.12, type: "triangle", volume: 0.2 },
    { freq: 1400, at: 0.1, length: 0.12, type: "sine", volume: 0.12 },
  ]);
}
