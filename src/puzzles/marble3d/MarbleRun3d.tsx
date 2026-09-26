"use client";

import { Play } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { boing, snap, tock } from "@/lib/audio/sfx";
import type { PuzzleProps } from "../types";
import { simulate, type RunEvent } from "./engine";
import { LEVELS, type Level, type Placed } from "./levels";
import { LIFT_PX } from "./constants";
import { PieceIcon3d } from "./PieceIcon3d";
import type { PlayingRun, SceneView } from "./Scene";
import { PIECE_TYPES, normalTurns, type CellRef, type PieceType } from "./track";

// three.js is big: load it only when a marble run is actually on screen.
const MarbleScene = dynamic(() => import("./Scene").then((m) => m.MarbleScene), { ssr: false });

const TRAY_HEIGHT = 120;
const TAP_SLOP = 8;
const HINT_MS = 4000;
/** After a miss has played out, the pause before a fresh marble drops in. */
const RESET_MS = 500;

type Built = Placed & { id: number };
type Drag = { id: number; type: PieceType; turns: number; from: "tray" | CellRef; startX: number; startY: number; moved: boolean; at: { x: number; y: number } };
type Phase = "build" | "running" | "solved";

const sameCell = (a: CellRef | null, b: CellRef | null) => !!a && !!b && a.col === b.col && a.row === b.row;

/** Free build: a bare board, just the start and the bucket, every other cell open. */
function freeBuild(level: Level): Level {
  const open: CellRef[] = [];
  for (let row = 0; row < level.rows; row++) {
    for (let col = 0; col < level.cols; col++) if (!(col === level.cup.col && row === level.cup.row)) open.push({ col, row });
  }
  return { ...level, name: "Free build", fixed: [], open, tray: [], solution: [] };
}

/**
 * Marble Run (spec §6.2), in 3D. Drag pieces from the tray into the dashed
 * squares, tap a placed piece to turn it, then press GO. The marble rolls
 * the run you built; a miss flies off, bounces away and a new marble drops
 * into the tube, with every piece left where it was.
 */
export function MarbleRun3d({ config, onSolved, onAttemptFailed, onProgress, hintRequest, sandbox = false }: PuzzleProps & { sandbox?: boolean }) {
  const levelNumber = config.type === "marbleRun" ? config.level : 1;
  const level = useMemo(() => (sandbox ? freeBuild(LEVELS[levelNumber - 1]) : LEVELS[levelNumber - 1]), [levelNumber, sandbox]);
  // Free build has endless pieces: the tray is one of each, and each drag takes a fresh copy.
  const tray = useMemo(() => (sandbox ? PIECE_TYPES : level.tray).map((type, id) => ({ id, type })), [level, sandbox]);
  const nextId = useRef(1000);

  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<SceneView | null>(null);
  const [built, setBuilt] = useState<Built[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [phase, setPhase] = useState<Phase>("build");
  const [run, setRun] = useState<PlayingRun | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [spawnedAt, setSpawnedAt] = useState(0);
  const editing = phase === "build";

  // The hint: a breathing ghost of one correct piece not yet in place, for a few seconds.
  const [seenHint, setSeenHint] = useState(hintRequest);
  const [hint, setHint] = useState<Placed | null>(null);
  if (hintRequest !== seenHint) {
    setSeenHint(hintRequest);
    const missing = level.solution.find((s) => !built.some((b) => sameCell(b, s) && b.type === s.type && normalTurns(b.type, b.turns) === normalTurns(s.type, s.turns)));
    setHint(missing ?? null);
  }
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), HINT_MS);
    return () => clearTimeout(timer);
  }, [hint]);

  /** The open square under a point. (The scene sits at the top-left of this component, so their coordinates agree.) */
  const openCellAt = (x: number, y: number): CellRef | null => {
    if (!view) return null;
    const cell = view.cellAt(x, y);
    return cell && level.open.some((c) => sameCell(c, cell)) ? cell : null;
  };

  const showDrag = drag !== null && (drag.from === "tray" || drag.moved);
  const lifted = drag ? { x: drag.at.x, y: drag.at.y - LIFT_PX } : null;
  const hoverCell = showDrag && lifted ? openCellAt(lifted.x, lifted.y) : null;
  const dragTurns = drag ? drag.turns : 0;
  const preview: Placed | null = hoverCell && drag ? { ...hoverCell, type: drag.type, turns: dragTurns } : null;
  // A piece being dragged off the board isn't drawn in its old square while it moves.
  const shown = drag?.moved && drag.from !== "tray" ? built.filter((b) => b.id !== drag.id) : built;
  const cellSize = view && level.open.length ? view.cellRect(level.open[0]).width : 150;

  const local = (event: ReactPointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };

  function startDrag(event: ReactPointerEvent, piece: { id: number; type: PieceType; turns: number }, from: "tray" | CellRef) {
    if (!editing) return;
    // Capture on the box, which never moves: iPad Safari drops a touch whose element leaves the page.
    box.current?.setPointerCapture(event.pointerId);
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

    // A tap on a placed piece turns it a quarter turn.
    if (!d.moved) {
      if (d.from !== "tray") {
        tock();
        setBuilt((b) => b.map((p) => (p.id === d.id ? { ...p, turns: normalTurns(p.type, p.turns + 1) } : p)));
        onProgress?.();
      }
      return;
    }

    const cell = openCellAt(d.at.x, d.at.y - LIFT_PX);
    const id = d.from === "tray" && sandbox ? nextId.current++ : d.id;
    setBuilt((current) => {
      const without = current.filter((p) => p.id !== d.id);
      if (!cell) return without; // dropped off the board: back to the tray
      // A square holds one piece: whatever was there goes back to the tray.
      return [...without.filter((p) => !sameCell(p, cell)), { id, type: d.type, turns: d.turns, ...cell }];
    });
    if (cell) {
      tock();
      onProgress?.();
    }
  }

  function go() {
    if (!editing) return;
    setHint(null);
    setRun({ ...simulate(level, built), startedAt: performance.now() });
    setPhase("running");
  }

  const onEvent = useCallback((kind: RunEvent["kind"]) => {
    if (kind === "fly") {
      boing();
      setMessage("Whoops! Try again.");
    }
    if (kind === "cup") snap();
  }, []);

  const callbacks = useRef({ onSolved, onAttemptFailed });
  useEffect(() => {
    callbacks.current = { onSolved, onAttemptFailed };
  });
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  const onEnd = useCallback(() => {
    const finished = runRef.current;
    if (!finished) return;
    if (finished.result === "cup" && !sandbox) {
      setPhase("solved");
      setMessage("In the bucket!");
      setTimeout(() => callbacks.current.onSolved(), 900);
      return;
    }
    if (finished.result === "cup") setMessage("In the bucket!");
    else {
      if (finished.reason === "stuck") setMessage("Whoops! It got stuck.");
      if (!sandbox) callbacks.current.onAttemptFailed?.();
    }
    // A fresh marble drops into the tube; every piece stays where it is.
    setTimeout(() => {
      setRun(null);
      setMessage(null);
      setSpawnedAt(performance.now());
      setPhase("build");
    }, RESET_MS);
  }, [sandbox]);

  // In free build the tray never empties; in a level, a placed piece leaves it.
  // The piece being dragged keeps its tray spot (faded) rather than vanishing:
  // iPad Safari ends a touch whose element is removed mid-touch.
  const inTray = sandbox ? tray : tray.filter((t) => !built.some((b) => b.id === t.id));

  return (
    <div
      ref={box}
      className="marble-run relative flex h-full w-full touch-none select-none flex-col"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      data-level={levelNumber}
      data-phase={phase}
    >
      <div className="marble-scene relative min-h-0 flex-1" role="img" aria-label={`Marble run, level ${levelNumber}: ${level.name}`}>
        <MarbleScene
          level={level}
          placed={shown}
          marked={sandbox ? [] : level.open}
          hoverCell={hoverCell}
          preview={preview}
          hint={hint}
          run={run}
          spawnedAt={spawnedAt}
          onView={setView}
          onEvent={onEvent}
          onEnd={onEnd}
        />

        {/* Build squares as real buttons over the board: tap to turn, drag to move. */}
        {view &&
          level.open.map((cell, i) => {
            const piece = built.find((b) => sameCell(b, cell));
            const r = view.cellRect(cell);
            return (
              <button
                key={`${cell.col},${cell.row}`}
                type="button"
                className="marble-cell absolute rounded-[18px] border-0 bg-transparent p-0 focus-visible:outline-3 focus-visible:outline-cream enabled:cursor-pointer"
                style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
                aria-label={piece ? `Build spot ${i + 1}: ${piece.type}, tap to turn it` : `Build spot ${i + 1}: empty`}
                data-cell={`${cell.col},${cell.row}`}
                data-type={piece?.type ?? ""}
                data-turns={piece ? piece.turns : ""}
                disabled={!editing || !piece}
                onPointerDown={(e) => piece && startDrag(e, piece, cell)}
              />
            );
          })}

        {message && (
          <p className="pointer-events-none absolute inset-x-0 top-2 z-10 text-center font-display text-4xl drop-shadow-[0_3px_0_rgb(8_14_36/0.6)]" role="status">
            {message}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 px-6" style={{ height: TRAY_HEIGHT }}>
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
              <PieceIcon3d type={piece.type} size={64} />
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
          style={{ left: lifted.x - cellSize / 2, top: lifted.y - cellSize / 2, opacity: hoverCell ? 0.35 : 1 }}
          data-dragging={drag!.type}
        >
          <PieceIcon3d type={drag!.type} turns={dragTurns} size={cellSize} />
        </div>
      )}
    </div>
  );
}
