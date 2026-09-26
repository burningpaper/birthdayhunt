"use client";

/**
 * iOS Safari only lets a page make sound after a user gesture, and only on
 * the specific audio objects touched during that gesture. So the "Tap to
 * start!" button calls `unlockAudio()`, which wakes up both sound paths we
 * use for the rest of the visit:
 *
 *   1. a Web Audio context, for synthesized sound effects
 *   2. one shared <audio> element, reused for every recording (voice lines,
 *      clues, lock questions)
 */

let context: AudioContext | null = null;
let voiceElement: HTMLAudioElement | null = null;
let unlocked = false;

// A tiny silent WAV, played once to bless the shared <audio> element.
const SILENCE =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  return context;
}

export function sharedVoiceElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!voiceElement) {
    voiceElement = new Audio();
    voiceElement.preload = "auto";
  }
  return voiceElement;
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

/** Call synchronously inside a tap handler. Safe to call more than once. */
export function unlockAudio(): void {
  const ctx = audioContext();
  if (ctx && ctx.state !== "running") {
    ctx.resume().catch((error) => console.warn("[audio] context resume failed", error));
  }

  const element = sharedVoiceElement();
  if (element && !unlocked) {
    element.src = SILENCE;
    element.play().catch((error: DOMException) => {
      // AbortError just means real audio replaced the silent clip, which is fine.
      if (error.name !== "AbortError") console.warn("[audio] voice element unlock failed", error);
    });
  }

  unlocked = true;
}
