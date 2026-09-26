"use client";

import { sharedVoiceElement } from "./engine";

/**
 * How the app talks: only ever with the parent's own recordings (voice
 * lines, clue recordings, lock questions), played through the shared,
 * already unlocked <audio> element. There's no text-to-speech: a line
 * without a recording is simply not said.
 */

export function stopTalking() {
  sharedVoiceElement()?.pause();
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

/**
 * Play a recording and resolve once it's over: finished, stopped early
 * (`stopTalking`), failed to load, or refused by the browser. Never rejects,
 * so whatever comes next always happens.
 */
export function playRecordingToEnd(url: string): Promise<void> {
  const element = sharedVoiceElement();
  if (!element) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      element.removeEventListener("ended", done);
      element.removeEventListener("pause", done);
      element.removeEventListener("error", done);
      resolve();
    };
    void playRecording(url).then((started) => {
      if (!started) return done();
      element.addEventListener("ended", done);
      element.addEventListener("pause", done);
      element.addEventListener("error", done);
    });
  });
}
