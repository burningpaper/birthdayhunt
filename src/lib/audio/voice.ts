"use client";

import { sharedVoiceElement } from "./engine";

/**
 * Two ways the app talks: the parent's own recordings, played through the
 * shared (already unlocked) <audio> element, and speech synthesis for
 * everything the parent didn't record.
 */

const PREFERRED_LANGS = ["en-ZA", "en-GB", "en-AU", "en-IE", "en-NZ"];

let cachedVoices: SpeechSynthesisVoice[] = [];

/**
 * Browsers load their voice list asynchronously; the first getVoices() call
 * is often empty. Warm the list up as soon as this module loads, so even the
 * very first spoken line gets the preferred accent.
 */
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const refresh = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
  refresh();
  window.speechSynthesis.addEventListener?.("voiceschanged", refresh);
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  for (const lang of PREFERRED_LANGS) {
    const match = voices.find((v) => v.lang.replace("_", "-") === lang);
    if (match) return match;
  }
  return voices.find((v) => v.lang.startsWith("en"));
}

export function stopTalking() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
  sharedVoiceElement()?.pause();
}

/** Speak a line in a friendly voice, interrupting anything already playing. */
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
  stopTalking();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? "en-GB";
  utterance.rate = 0.95;
  utterance.pitch = 1.1;
  window.speechSynthesis.speak(utterance);
}

/** Play a recording through the unlocked shared element. Resolves false if the browser refused. */
export async function playRecording(url: string): Promise<boolean> {
  const element = sharedVoiceElement();
  if (!element) return false;
  stopTalking();
  element.src = url;
  element.currentTime = 0;
  try {
    await element.play();
    return true;
  } catch (error) {
    console.warn("[audio] recording playback was blocked", error);
    return false;
  }
}

/** A recording if there is one, otherwise the spoken text. */
export function sayOrPlay(text: string, recordingUrl?: string) {
  if (recordingUrl) {
    void playRecording(recordingUrl);
  } else {
    speak(text);
  }
}
