"use client";

/* eslint-disable @next/next/no-img-element -- card photos are the parent's uploads */
import {
  AirplaneTilt,
  Bicycle,
  Bird,
  Butterfly,
  Car,
  Cat,
  Dog,
  Fish,
  Hammer,
  PaintBrush,
  Rabbit,
  RocketLaunch,
  Sailboat,
  Scissors,
  Sparkle,
  Tractor,
  Wrench,
  type Icon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { snap, tock } from "@/lib/audio/sfx";
import { seededRng } from "../random";
import type { PuzzleProps } from "../types";
import { useElementSize } from "../useElementSize";
import { chooseFaces, dealDeck, gridFor, initialState, isFaceUp, isSolved, reduce, type Face, type MemoryState } from "./logic";

const ICONS: Record<string, Icon> = {
  Car,
  AirplaneTilt,
  Sailboat,
  RocketLaunch,
  Tractor,
  Bicycle,
  Cat,
  Dog,
  Fish,
  Butterfly,
  Rabbit,
  Bird,
  Hammer,
  Wrench,
  PaintBrush,
  Scissors,
};

const MISMATCH_MS = 1000;
const PEEK_MS = 1500;
const GAP = 14;
const CARD_ASPECT = 4 / 5; // width / height

const HALF_TURN = {
  initial: { rotateY: -90 },
  animate: { rotateY: 0 },
  exit: { rotateY: 90 },
  transition: { duration: 0.13, ease: "easeInOut" },
  style: { transformPerspective: 900 },
} as const;

/**
 * Memory Match (spec §6.4). Flip two cards; a pair stays up with a sparkle,
 * a mismatch flips back after a second. No buzzers, no timer.
 */
export function MemoryMatch({ config, onSolved, onAttemptFailed, onProgress, hintRequest }: PuzzleProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  // A fresh deal each visit, so reloading doesn't hand over a memorised board.
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));

  const pairs = config.type === "memoryMatch" ? config.pairs : 6;
  const photoUrls = config.type === "memoryMatch" ? config.photoUrls : undefined;
  const { faces, deck } = useMemo(() => {
    const rng = seededRng(seed);
    const chosen = chooseFaces(pairs, photoUrls, rng);
    return { faces: new Map(chosen.map((f) => [f.id, f])), deck: dealDeck(chosen, rng) };
  }, [seed, pairs, photoUrls]);

  const [state, setState] = useState<MemoryState>(() => initialState(deck));
  const [donePeek, setDonePeek] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peeking = hintRequest > donePeek;

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  // The hint: every card face-up for a moment (spec §6.4).
  useEffect(() => {
    if (hintRequest === 0) return;
    const timer = setTimeout(() => setDonePeek(hintRequest), PEEK_MS);
    return () => clearTimeout(timer);
  }, [hintRequest]);

  function flip(index: number) {
    if (peeking) return;
    const next = reduce(state, { type: "flip", index });
    if (next === state) return;
    setState(next);

    const matchedNow = next.matched.filter(Boolean).length > state.matched.filter(Boolean).length;
    if (matchedNow) {
      snap();
      onProgress?.();
      if (isSolved(next)) setTimeout(onSolved, 900);
    } else {
      tock();
    }
    if (next.locked) {
      onAttemptFailed?.();
      hideTimer.current = setTimeout(() => setState((s) => reduce(s, { type: "hide" })), MISMATCH_MS);
    }
  }

  const { cols, rows } = gridFor(deck.length);
  const cardW = size
    ? Math.min((size.width - GAP * (cols - 1)) / cols, ((size.height - GAP * (rows - 1)) / rows) * CARD_ASPECT)
    : 0;

  return (
    <div ref={ref} className="grid h-full w-full place-items-center px-6 pb-6">
      {size && (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${cardW}px)`, gap: GAP }} role="grid" aria-label="Memory cards">
          {state.deck.map((faceId, index) => (
            <Card
              key={index}
              index={index}
              face={faces.get(faceId)!}
              width={cardW}
              up={peeking || isFaceUp(state, index)}
              matched={state.matched[index]}
              onFlip={() => flip(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type CardProps = { index: number; face: Face; width: number; up: boolean; matched: boolean; onFlip: () => void };

function Card({ index, face, width, up, matched, onFlip }: CardProps) {
  return (
    <button
      type="button"
      className="memory-card relative"
      style={{ width, height: width / CARD_ASPECT }}
      onClick={onFlip}
      aria-label={up ? faceLabel(face) : `Card ${index + 1}, face down`}
      data-face={face.id}
      data-up={up}
      data-matched={matched}
    >
      {/*
        A flip is two half-turns: the old face turns edge-on and leaves, then the
        new face turns in. Only one face ever exists, so nothing relies on
        backface-visibility, which WebKit doesn't honour reliably.
      */}
      <AnimatePresence mode="wait" initial={false}>
        {up ? (
          <motion.span key="front" {...HALF_TURN} className={`memory-face plastic plastic-cream is-tile grid place-items-center overflow-hidden ${matched ? "is-matched" : ""}`}>
            <FaceArt face={face} width={width} />
          </motion.span>
        ) : (
          <motion.span key="back" {...HALF_TURN} className="memory-face plastic plastic-sunflower is-tile grid place-items-center">
            <span className="font-display leading-none text-ink/80" style={{ fontSize: width * 0.5 }}>?</span>
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {matched && (
          <motion.span
            className="pointer-events-none absolute -top-3 -right-3 text-sunflower drop-shadow-[0_3px_0_#B8860B]"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 14 }}
          >
            <Sparkle weight="fill" size={Math.max(28, width * 0.3)} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function FaceArt({ face, width }: { face: Face; width: number }) {
  if (face.kind === "photo") {
    return <img src={face.url} alt="" draggable={false} className="absolute inset-1.5 size-[calc(100%-12px)] rounded-[10px] object-cover" />;
  }
  const Glyph = ICONS[face.icon];
  return <Glyph weight="fill" size={width * 0.62} style={{ color: `var(--color-${face.color})` }} />;
}

function faceLabel(face: Face): string {
  return face.kind === "photo" ? "A photo card" : face.icon.replace(/([a-z])([A-Z])/g, "$1 $2");
}
