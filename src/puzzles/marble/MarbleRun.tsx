"use client";

import { Play } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { boing, snap, tock } from "@/lib/audio/sfx";
import type { PuzzleProps } from "../types";
import { useElementSize } from "../useElementSize";
import { LIFT_PX } from "./constants";
import { LEVELS, WORLD, ZONE_SIZE, type Placement } from "./levels";
import { PieceIcon } from "./PieceIcon";
import { PIECE_TYPES, sameOrientation, type PieceType, type Point } from "./pieces";
import { drawFrame } from "./render";
import { TICK_MS, createRun, stepRun, type MarbleWorld } from "./world";

const TRAY_HEIGHT = 120;
const TAP_SLOP = 8;
const MISS_RESET_MS = 2000;
const HINT_MS = 4000;


type TrayPiece = { id: number; type: PieceType };
/** Where a piece is: in the tray, or in a zone with a rotation. */
type Built = { id: number; type: PieceType; zone: number; turns: number };
type Drag = { id: number; type: PieceType; turns: number; from: "tray" | number; startX: number; startY: number; moved: boolean; at: Point };

/**
 * Marble Run (spec §6.2). Drag pieces from the tray into the glowing build
 * zones, tap a placed piece to turn it, then press GO. A miss rolls away and
 * resets; the pieces stay where they are.
 */
export function MarbleRun({ config, onSolved, onAttemptFailed, onProgress, hintRequest, sandbox = false }: PuzzleProps & { sandbox?: boolean }) {
  const levelNumber = config.type === "marbleRun" ? config.level : 1;
  const level = LEVELS[levelNumber - 1];
  // Free build: two of every piece, just for fun.
  const tray: TrayPiece[] = useMemo(
    () => (sandbox ? PIECE_TYPES.flatMap((t) => [t, t]) : level.tray).map((type, id) => ({ id, type })),
    [level, sandbox],
  );
  const { ref, size } = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);

  const [built, setBuilt] = useState<Built[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [phase, setPhase] = useState<"build" | "running" | "missed" | "solved">("build");
  const [cheer, setCheer] = useState<string | null>(null);
  const sandboxRef = useRef(sandbox);
  const run = useRef<MarbleWorld | null>(null);
  const placed: Placement[] = built.map(({ zone, type, turns }) => ({ zone, type, turns }));

  // The hint: a ghost of one correct piece not yet in place (React's
  // "adjust state when a prop changes" pattern), shown for a few seconds.
  const [seenHint, setSeenHint] = useState(hintRequest);
  const [ghost, setGhost] = useState<Placement | null>(null);
  if (hintRequest !== seenHint) {
    setSeenHint(hintRequest);
    const missing = level.solution.find((s) => !built.some((b) => b.zone === s.zone && b.type === s.type && sameOrientation(s.type, b.turns, s.turns)));
    setGhost(missing ?? null);
  }
  useEffect(() => {
    if (!ghost) return;
    const timer = setTimeout(() => setGhost(null), HINT_MS);
    return () => clearTimeout(timer);
  }, [ghost]);

  // Layout: the scene fills the space above the tray, keeping its shape.
  const scale = size ? Math.min(size.width / WORLD.width, (size.height - TRAY_HEIGHT) / WORLD.height) : 1;
  const sceneW = WORLD.width * scale;
  const sceneH = WORLD.height * scale;
  const sceneLeft = size ? (size.width - sceneW) / 2 : 0;

  // Drawing (and running) loop.
  const frameState = useRef({ placed, ghost, hoverZone: null as number | null });
  const showDrag = drag !== null && (drag.from === "tray" || drag.moved);
  const lifted = drag ? { x: drag.at.x, y: drag.at.y - LIFT_PX } : null;
  const hoverZone = showDrag && lifted ? zoneAt(lifted) : null;
  // A piece picked up off the board isn't drawn in its old spot while it moves.
  const drawnPlaced = drag?.moved && drag.from !== "tray" ? placed.filter((p) => p.zone !== drag.from) : placed;
  useEffect(() => {
    frameState.current = { placed: drawnPlaced, ghost, hoverZone };
  });
  const callbacks = useRef({ onSolved, onAttemptFailed });
  useEffect(() => {
    callbacks.current = { onSolved, onAttemptFailed };
  });

  useEffect(() => {
    if (!size) return;
    let raf = 0;
    let last = 0; // set on the first frame
    let carry = 0;
    const frame = (now: number) => {
      if (!last) last = now;
      const world = run.current;
      if (world) {
        carry += Math.min(now - last, 100);
        while (carry >= TICK_MS && world.result === "running") {
          carry -= TICK_MS;
          const result = stepRun(world);
          if (result === "cup" && sandboxRef.current) {
            snap();
            setPhase("missed"); // reuse the reset path: the marble goes back to the top, pieces stay
            setCheer("In the cup!");
            setTimeout(() => {
              run.current = null;
              setCheer(null);
              setPhase("build");
            }, MISS_RESET_MS);
          } else if (result === "cup") {
            snap();
            setPhase("solved");
            setTimeout(() => callbacks.current.onSolved(), 900);
          } else if (result === "miss") {
            boing();
            if (!sandboxRef.current) callbacks.current.onAttemptFailed?.();
            setPhase("missed");
            setTimeout(() => {
              run.current = null;
              setPhase("build");
            }, MISS_RESET_MS);
          }
        }
      }
      last = now;
      const ctx = canvas.current?.getContext("2d");
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
        const s = frameState.current;
        drawFrame(ctx, {
          level,
          placed: s.placed,
          marble: world ? world.marble.position : null,
          tick: world ? world.tick : 0,
          ghost: s.ghost,
          hoverZone: s.hoverZone,
          time: now,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [level, scale, size]);

  /** Which build zone a screen point (relative to this component) is over. */
  function zoneAt(at: Point): number | null {
    const wx = (at.x - sceneLeft) / scale;
    const wy = at.y / scale;
    const i = level.zones.findIndex((z) => Math.abs(wx - z.x) <= ZONE_SIZE / 2 && Math.abs(wy - z.y) <= ZONE_SIZE / 2);
    return i === -1 ? null : i;
  }

  const local = (event: ReactPointerEvent): Point => {
    const box = ref.current!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const editing = phase === "build";

  function startDrag(event: ReactPointerEvent, piece: { id: number; type: PieceType; turns: number }, from: "tray" | number) {
    if (!editing) return;
    ref.current?.setPointerCapture(event.pointerId);
    const at = local(event);
    setDrag({ ...piece, from, startX: at.x, startY: at.y, moved: false, at });
  }

  function onPointerMove(event: ReactPointerEvent) {
    if (!drag) return;
    const at = local(event);
    const moved = drag.moved || Math.hypot(at.x - drag.startX, at.y - drag.startY) > TAP_SLOP;
    setDrag({ ...drag, at, moved });
  }

  function onPointerUp() {
    const d = drag;
    setDrag(null);
    if (!d) return;

    // A tap on a placed piece turns it 45°.
    if (!d.moved) {
      if (d.from !== "tray") {
        tock();
        setBuilt((b) => b.map((p) => (p.id === d.id ? { ...p, turns: p.turns + 1 } : p)));
        onProgress?.();
      }
      return;
    }

    const zone = zoneAt({ x: d.at.x, y: d.at.y - LIFT_PX });
    setBuilt((current) => {
      const without = current.filter((p) => p.id !== d.id);
      if (zone === null) return without; // dropped outside a zone: back to the tray
      // A zone holds one piece: whatever was there goes back to the tray.
      const cleared = without.filter((p) => p.zone !== zone);
      return [...cleared, { id: d.id, type: d.type, zone, turns: d.from === "tray" ? 0 : d.turns }];
    });
    if (zone !== null) {
      tock();
      onProgress?.();
    }
  }

  function go() {
    if (!editing) return;
    run.current = createRun(level, placed);
    setPhase("running");
  }

  // The piece being dragged stays in the tray as a faded gap rather than
  // disappearing: iPad Safari stops a touch's events if the element it began
  // on is removed from the page mid-touch.
  const inTray = tray.filter((t) => !built.some((b) => b.id === t.id));

  return (
    <div ref={ref} className="relative h-full w-full touch-none select-none" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}>
      {size && (
        <>
          <canvas
            ref={canvas}
            width={Math.round(sceneW * (window.devicePixelRatio || 1))}
            height={Math.round(sceneH * (window.devicePixelRatio || 1))}
            style={{ position: "absolute", left: sceneLeft, top: 0, width: sceneW, height: sceneH }}
            className="marble-run"
            role="img"
            aria-label={`Marble run, level ${levelNumber}: ${level.name}`}
            data-level={levelNumber}
            data-phase={phase}
          />

          {/* Build zones as real buttons over the canvas: tap to turn, drag to move. */}
          {level.zones.map((z, i) => {
            const piece = built.find((b) => b.zone === i);
            return (
              <button
                key={i}
                type="button"
                className="marble-zone absolute rounded-[18px] border-0 bg-transparent p-0 focus-visible:outline-3 focus-visible:outline-cream enabled:cursor-pointer"
                style={{ left: sceneLeft + (z.x - ZONE_SIZE / 2) * scale, top: (z.y - ZONE_SIZE / 2) * scale, width: ZONE_SIZE * scale, height: ZONE_SIZE * scale }}
                aria-label={piece ? `Build spot ${i + 1}: ${piece.type}, tap to turn it` : `Build spot ${i + 1}: empty`}
                data-zone={i}
                data-type={piece?.type ?? ""}
                data-turns={piece ? ((piece.turns % 8) + 8) % 8 : ""}
                disabled={!editing || !piece}
                onPointerDown={(e) => piece && startDrag(e, piece, i)}
              />
            );
          })}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 px-6" style={{ height: TRAY_HEIGHT }}>
            {/* Not a scroll area: a finger drag starting here must never become a scroll. */}
            <div className="flex flex-1 touch-none flex-wrap items-center gap-3 rounded-[var(--radius-panel)] bg-toybox-glow/60 px-4 py-2" aria-label="Pieces">
              {inTray.length === 0 && <span className="px-2 text-lg font-semibold text-cream/60">All your pieces are on the run!</span>}
              {inTray.map((piece) => (
                <button
                  key={piece.id}
                  type="button"
                  className={`plastic plastic-cream is-tile is-pressable grid size-20 shrink-0 touch-none place-items-center transition-opacity ${drag?.id === piece.id ? "opacity-25" : ""}`}
                  aria-label={`${piece.type} piece`}
                  data-piece={piece.id}
                  data-type={piece.type}
                  disabled={!editing}
                  onPointerDown={(e) => startDrag(e, { ...piece, turns: 0 }, "tray")}
                >
                  <PieceIcon type={piece.type} size={60} icon />
                </button>
              ))}
            </div>
            <PlasticButton size="lg" color="grass" onClick={go} disabled={!editing} aria-label="GO: drop the marble">
              <Play weight="fill" size={36} />
              GO!
            </PlasticButton>
          </div>

          {showDrag && lifted && (
            <div
              className="marble-drag pointer-events-none absolute z-20"
              style={{ left: lifted.x - 100 * scale, top: lifted.y - 100 * scale }}
              data-dragging={drag!.type}
            >
              <PieceIcon type={drag!.type} turns={drag!.from === "tray" ? 0 : drag!.turns} size={200 * scale} />
            </div>
          )}

          {phase === "missed" && (
            <p className="pointer-events-none absolute inset-x-0 z-10 text-center font-display text-4xl" style={{ top: sceneH * 0.08 }}>
              {cheer ?? "Whoops! Try moving a piece."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
