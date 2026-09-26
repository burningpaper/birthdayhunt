"use client";

import { Flag } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { boing, snap, tock } from "@/lib/audio/sfx";
import type { PuzzleProps } from "../types";
import { useElementSize } from "../useElementSize";
import { WORLD, holesFor, type Point } from "./holes";
import { drawFrame } from "./render";
import { MAX_SPEED, POWER, TICK_MS, createWorld, isAtRest, platformX, predictPath, shoot, step, type GolfWorld } from "./world";

/** How far you can pull back (beyond this the shot is already at full power). */
const MAX_PULL = MAX_SPEED / POWER;
/** How near the ball a touch must start to grab it (world units). */
const GRAB_RADIUS = 110;
const MIN_PULL = 12;
const SHORT_AIM_TICKS = 24;
const HINT_AIM_TICKS = 110;
const NEXT_HOLE_MS = 1400;

/**
 * Flick Golf (spec §6.5): side-on golf. Pull back from the ball, watch the
 * dotted line, let go. Unlimited shots; a lost ball comes back to where it
 * last rested. Sink every hole to finish.
 */
export function FlickGolf({ config, onSolved, onAttemptFailed, onProgress, hintRequest }: PuzzleProps) {
  const holeCount = config.type === "flickGolf" ? config.holes : 1;
  // Stable across renders: the game loop restarts (and rebuilds the world) whenever this changes.
  const holes = useMemo(() => holesFor(holeCount), [holeCount]);
  const { ref, size } = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [holeIndex, setHoleIndex] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [atRest, setAtRest] = useState(true);

  const world = useRef<GolfWorld | null>(null);
  const aim = useRef<{ pull: Point } | null>(null);
  const hintArmed = useRef(false);
  const callbacks = useRef({ onSolved, onAttemptFailed, onProgress });
  useEffect(() => {
    callbacks.current = { onSolved, onAttemptFailed, onProgress };
  });

  // The hint: the next aim shows the whole flight, not just its start.
  useEffect(() => {
    if (hintRequest > 0) hintArmed.current = true;
  }, [hintRequest]);

  const scale = size ? Math.min(size.width / WORLD.width, size.height / WORLD.height) : 1;
  const offset = size ? { x: (size.width - WORLD.width * scale) / 2, y: (size.height - WORLD.height * scale) / 2 } : { x: 0, y: 0 };

  // One physics world per hole, and a fixed-step loop that draws every frame.
  useEffect(() => {
    const hole = holes[holeIndex];
    world.current = createWorld(hole);
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    let finished = false;

    const frame = (now: number) => {
      const w = world.current!;
      carry += Math.min(now - last, 100);
      last = now;
      while (carry >= TICK_MS && !finished) {
        carry -= TICK_MS;
        const event = step(w);
        if (event === "sunk") {
          finished = true;
          snap();
          callbacks.current.onProgress?.();
          const last = holeIndex === holes.length - 1;
          setBanner(last ? "In the hole!" : `Hole ${holeIndex + 1} done!`);
          setTimeout(() => {
            setBanner(null);
            if (last) {
              callbacks.current.onSolved();
            } else {
              setHoleIndex((i) => i + 1);
              setAtRest(true); // the new hole's ball waits on its tee
            }
          }, NEXT_HOLE_MS);
        } else if (event === "lost") {
          boing();
          callbacks.current.onAttemptFailed?.();
          setAtRest(true);
        } else if (event === "stopped") {
          callbacks.current.onAttemptFailed?.();
          setAtRest(true);
        }
      }

      const ctx = canvas.current?.getContext("2d");
      if (ctx && canvas.current) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
        const pull = aim.current?.pull;
        drawFrame(ctx, {
          hole,
          ball: w.ball.position,
          platformX: platformX(w),
          aim: pull ? { pull, dots: predictPath(w.ball.position, pull, hintArmed.current ? HINT_AIM_TICKS : SHORT_AIM_TICKS) } : null,
          ready: isAtRest(w) && !pull,
          time: now,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [holeIndex, holes, scale]);

  const toWorld = (event: ReactPointerEvent): Point => {
    const box = canvas.current!.getBoundingClientRect();
    return { x: (event.clientX - box.left) / scale, y: (event.clientY - box.top) / scale };
  };

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const w = world.current;
    if (!w || !isAtRest(w)) return;
    const at = toWorld(event);
    if (Math.hypot(at.x - w.ball.position.x, at.y - w.ball.position.y) > GRAB_RADIUS) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    aim.current = { pull: { x: 0, y: 0 } };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const w = world.current;
    if (!aim.current || !w) return;
    const at = toWorld(event);
    let pull = { x: at.x - w.ball.position.x, y: at.y - w.ball.position.y };
    const length = Math.hypot(pull.x, pull.y);
    if (length > MAX_PULL) pull = { x: (pull.x / length) * MAX_PULL, y: (pull.y / length) * MAX_PULL };
    aim.current = { pull };
  }

  function onPointerUp() {
    const w = world.current;
    const pull = aim.current?.pull;
    aim.current = null;
    if (!w || !pull || Math.hypot(pull.x, pull.y) < MIN_PULL) return;
    tock();
    hintArmed.current = false;
    shoot(w, pull);
    setAtRest(false);
  }

  const hole = holes[holeIndex];

  return (
    <div ref={ref} className="relative h-full w-full">
      <div className="pointer-events-none absolute top-0 left-6 z-10 flex items-center gap-3">
        <span className="plastic plastic-tangerine flex items-center gap-2 px-4 py-2 font-display text-2xl">
          <Flag weight="fill" size={26} />
          Hole {holeIndex + 1} of {holes.length}
        </span>
        <span className="flex gap-1.5" aria-hidden>
          {holes.map((_, i) => (
            <span key={i} className={`size-3.5 rounded-full ${i < holeIndex ? "bg-grass" : i === holeIndex ? "bg-sunflower" : "bg-cream/25"}`} />
          ))}
        </span>
      </div>

      {size && (
        <canvas
          ref={canvas}
          width={Math.round(WORLD.width * scale * (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1))}
          height={Math.round(WORLD.height * scale * (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1))}
          style={{ position: "absolute", left: offset.x, top: offset.y, width: WORLD.width * scale, height: WORLD.height * scale }}
          className="golf-course touch-none"
          role="img"
          aria-label={`Flick golf, hole ${holeIndex + 1}: ${hole.name}`}
          data-hole={holeIndex}
          data-holes={holes.length}
          data-at-rest={atRest}
          data-scale={scale}
          data-test-shot={`${hole.testShot.x},${hole.testShot.y}`}
          data-tee={`${hole.tee.x},${hole.tee.y}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (aim.current = null)}
        />
      )}

      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner}
            className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 16 }}
          >
            <p className="plastic plastic-sunflower is-panel px-10 py-5 font-display text-6xl">{banner}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
