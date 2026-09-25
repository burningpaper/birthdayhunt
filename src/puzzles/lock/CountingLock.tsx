"use client";

import { CaretDown, CaretUp, Check } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { SpeakerButton } from "@/components/plastic/SpeakerButton";
import { rattle, unlock } from "@/lib/audio/sfx";
import { sayOrPlay, speak } from "@/lib/audio/voice";
import type { LockQuestion } from "@/lib/schema";
import type { PuzzleProps } from "../types";
import { checkDials, dialOfWheel, dialValues, hintDial, hintText, spin, wheelCount } from "./logic";

const OPEN_MS = 1300;

type Hint = { dial: number; text: string } | null;

/**
 * Counting Lock (spec §6.6). Each dial asks a question about the house
 * ("How many cushions are on the couch?"), so solving it means going to look.
 */
export function CountingLock({ config, onSolved, onAttemptFailed, onProgress, hintRequest }: PuzzleProps) {
  const digits = config.type === "countingLock" ? config.digits : 1;
  const questions: LockQuestion[] = config.type === "countingLock" ? config.questions : [];
  const answers = questions.map((q) => q.answer);

  const [wheels, setWheels] = useState<number[]>(() => Array(wheelCount(digits)).fill(0));
  const [lastSpin, setLastSpin] = useState<number[]>(() => Array(wheelCount(digits)).fill(1));
  // Which dials were right at the last "Open!"; null for a dial changed since.
  const [checked, setChecked] = useState<(boolean | null)[]>(() => Array(digits).fill(null));
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);

  const values = dialValues(digits, wheels);

  // A new hint request: work out which dial to talk about (React's
  // "adjust state when a prop changes" pattern, no effect needed).
  const [seenHint, setSeenHint] = useState(hintRequest);
  const [hint, setHint] = useState<Hint>(null);
  if (hintRequest !== seenHint) {
    setSeenHint(hintRequest);
    const dial = hintDial(checkDials(values, answers), hintRequest);
    setHint(dial === null ? null : { dial, text: hintText(dial, values[dial], answers[dial], digits) });
  }
  useEffect(() => {
    if (hint) speak(hint.text);
  }, [hint]);

  function turn(wheel: number, delta: 1 | -1) {
    if (open) return;
    setWheels((w) => w.map((v, i) => (i === wheel ? spin(v, delta) : v)));
    setLastSpin((s) => s.map((v, i) => (i === wheel ? delta : v)));
    const dial = dialOfWheel(digits, wheel);
    setChecked((c) => c.map((v, i) => (i === dial ? null : v)));
    setMessage(null);
    if (hint?.dial === dial) setHint(null);
  }

  function tryOpen() {
    if (open) return;
    const result = checkDials(values, answers);
    setHint(null);
    if (result.every(Boolean)) {
      setOpen(true);
      setChecked(result);
      setMessage(null);
      unlock();
      onProgress?.();
      setTimeout(onSolved, OPEN_MS);
      return;
    }
    const newlyRight = result.filter((ok, i) => ok && checked[i] !== true).length > 0;
    if (newlyRight) onProgress?.();
    setChecked(result);
    setAttempt((n) => n + 1);
    rattle();
    onAttemptFailed?.();
    const line = result.some(Boolean) ? "Close! The green ones are right. Check the others again." : "Close! Check again.";
    setMessage(line);
    speak(line);
  }

  const bubble = hint?.text ?? message;

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-10 px-10 pb-8">
      <div className="grid justify-items-center gap-6">
        <div className="h-16">
          <AnimatePresence mode="wait">
            {bubble && (
              <motion.p
                key={bubble}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-[var(--radius-button)] bg-cream px-5 py-3 text-center text-xl font-bold text-balance text-ink shadow-[0_6px_0_rgb(8_14_36_/_0.35)]"
                role="status"
              >
                {bubble}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div key={attempt} className={`relative grid justify-items-center ${attempt > 0 ? "rattle" : ""}`} data-open={open}>
          <Shackle open={open} />
          <div className="plastic plastic-bubblegum is-panel -mt-3 flex gap-5 px-8 pt-8 pb-6">
            {wheels.map((value, wheel) => {
              const dial = dialOfWheel(digits, wheel);
              const state = checked[dial];
              return (
                <div key={wheel} className="grid justify-items-center gap-3">
                  <PlasticButton round size="md" color="cream" aria-label={`${wheelName(digits, wheel)} up`} onClick={() => turn(wheel, 1)}>
                    <CaretUp weight="fill" size={30} />
                  </PlasticButton>
                  <div
                    className={`dial-window relative grid h-28 w-24 place-items-center overflow-hidden rounded-[var(--radius-tile)] ${
                      state === true ? "is-right" : hint?.dial === dial ? "is-hinted" : ""
                    }`}
                    data-dial={dial}
                    data-wheel={wheel}
                    data-value={value}
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        key={value}
                        initial={{ y: lastSpin[wheel] * 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: lastSpin[wheel] * -60, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 32 }}
                        className="font-display text-7xl leading-none text-ink"
                      >
                        {value}
                      </motion.span>
                    </AnimatePresence>
                    {state === true && <Check weight="bold" size={22} className="absolute top-1.5 right-1.5 text-grass" aria-label="Right" />}
                  </div>
                  <PlasticButton round size="md" color="cream" aria-label={`${wheelName(digits, wheel)} down`} onClick={() => turn(wheel, -1)}>
                    <CaretDown weight="fill" size={30} />
                  </PlasticButton>
                  {digits > 1 && <span className="grid size-9 place-items-center rounded-full bg-cream font-display text-xl text-bubblegum">{dial + 1}</span>}
                </div>
              );
            })}
          </div>
        </div>

        <PlasticButton size="lg" color="sunflower" onClick={tryOpen} disabled={open}>
          Open!
        </PlasticButton>
      </div>

      <ol className="grid gap-4">
        {Array.from({ length: digits }, (_, i) => questions[i]).map((question, i) => (
          <li key={i} className={`flex items-center gap-4 rounded-[var(--radius-panel)] bg-toybox-glow/70 p-5 ${hint?.dial === i ? "ring-4 ring-sunflower" : ""}`}>
            {digits > 1 && <span className="grid size-12 shrink-0 place-items-center rounded-full bg-bubblegum font-display text-2xl text-cream">{i + 1}</span>}
            <p className="flex-1 text-2xl leading-snug font-semibold text-balance">{question?.questionText || "This question hasn't been written yet."}</p>
            {question?.questionText && (
              <SpeakerButton onSpeak={() => sayOrPlay(question.questionText, question.questionAudioUrl)} label={`Hear question ${i + 1}`} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function wheelName(digits: 1 | 2 | 3, wheel: number): string {
  if (digits === 1) return wheel === 0 ? "Tens" : "Ones";
  return `Dial ${wheel + 1}`;
}

/** The silver shackle. It pops up and swings aside when the lock opens. */
function Shackle({ open }: { open: boolean }) {
  return (
    <motion.svg
      width="220"
      height="130"
      viewBox="0 0 220 130"
      aria-hidden
      animate={open ? { y: [0, -44, -44], rotate: [0, 0, -18] } : { y: 0, rotate: 0 }}
      transition={{ duration: 0.8, times: [0, 0.45, 1], ease: "easeOut" }}
      style={{ originX: "86%", originY: "100%" }}
    >
      <defs>
        <linearGradient id="shackle-metal" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#9AA6BF" />
          <stop offset="0.35" stopColor="#F4F7FB" />
          <stop offset="0.6" stopColor="#C5CEDD" />
          <stop offset="1" stopColor="#7F8BA6" />
        </linearGradient>
      </defs>
      <path d="M36 130 V84 A74 74 0 0 1 184 84 V130" fill="none" stroke="#5B6781" strokeWidth="34" strokeLinecap="round" transform="translate(0 4)" />
      <path d="M36 130 V84 A74 74 0 0 1 184 84 V130" fill="none" stroke="url(#shackle-metal)" strokeWidth="30" strokeLinecap="round" />
    </motion.svg>
  );
}
