"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { snap } from "@/lib/audio/sfx";
import type { PuzzleProps } from "../types";
import { SHAPE, drawTo, insideCat, makeMaze, same, type Cell, type Maze as MazeData } from "./logic";

const HINT_MS = 4000;
const HINT_CELLS = 6;
const COLORS = { fur: "#FF9A3C", furEdge: "#C2570C", cream: "#FFE7C2", wall: "#5B2A0A", line: "#2F6BEA", lineLight: "#9CC0FF", done: "#22A94F", doneLight: "#9BE3B2", heart: "#F0453A" };

/** The fish at the end of the line, facing the way it last moved. */
function fishAt(path: Cell[]) {
  const end = path[path.length - 1];
  const prev = path[path.length - 2] ?? { c: end.c - 1, r: end.r };
  return { x: end.c + 0.5, y: end.r + 0.5, angle: Math.atan2(end.r - prev.r, end.c - prev.c) };
}

/** How far along the true route a path is before it strays. */
function correctPrefix(path: Cell[], solution: Cell[]) {
  let n = 0;
  while (n < path.length && n < solution.length && same(path[n], solution[n])) n++;
  return n;
}

/**
 * Cat Maze: guide the fish with a finger, in through the cat's open mouth and
 * through the maze to its tummy. The fish swims along the end of the line,
 * which keeps to the corridors (a quick swipe fills in the corridor it
 * skipped), going back over it rubs it out, and lifting the finger keeps
 * what's drawn, so it can be carried on from the end.
 */
export function Maze({ config, onSolved, onAttemptFailed, onProgress, hintRequest }: PuzzleProps) {
  const grid = config.type === "maze" ? config.grid : 19;
  const seed = config.type === "maze" ? config.seed : 1;
  const maze = useMemo(() => makeMaze(grid, seed), [grid, seed]);
  const reduceMotion = useReducedMotion();

  const svg = useRef<SVGSVGElement>(null);
  const [path, setPathState] = useState<Cell[]>([]);
  const pathRef = useRef<Cell[]>([]); // the latest path, for fast pointer moves between renders
  const drawing = useRef(false);
  const best = useRef(1);
  const [solved, setSolved] = useState(false);

  // The hint: the next few cells of the true route, from wherever the drawing is still right.
  const [seenHint, setSeenHint] = useState(hintRequest);
  const [hint, setHint] = useState<Cell[]>([]);
  if (hintRequest !== seenHint) {
    setSeenHint(hintRequest);
    const k = Math.max(1, correctPrefix(path, maze.solution));
    setHint(maze.solution.slice(k - 1, k - 1 + HINT_CELLS));
  }
  useEffect(() => {
    if (!hint.length) return;
    const timer = setTimeout(() => setHint([]), HINT_MS);
    return () => clearTimeout(timer);
  }, [hint]);

  const setPath = (next: Cell[]) => {
    if (next === pathRef.current) return;
    pathRef.current = next;
    setPathState(next);
    const right = correctPrefix(next, maze.solution);
    if (right > best.current) {
      best.current = right;
      onProgress?.();
    }
    const end = next[next.length - 1];
    if (end && same(end, maze.tummy) && !solved) {
      setSolved(true);
      drawing.current = false;
      snap();
      setTimeout(onSolved, 1100);
    }
  };

  const mouth = useMemo(() => mouthGeometry(maze), [maze]);

  const pointFrom = (event: ReactPointerEvent): { x: number; y: number } | null => {
    const ctm = svg.current?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  /** The fish starts the path: a touch on it, or on the mouth it's about to swim into. */
  const startsHere = (p: { x: number; y: number }) => {
    const onFish = Math.hypot(p.x - mouth.fishHome.x, p.y - mouth.fishHome.y) <= 1.6 * mouth.u;
    const inMouth = p.x >= mouth.out - 0.3 * mouth.u && p.x <= maze.mouth.c + 2 && Math.abs(p.y - mouth.y) <= mouth.open + 0.5;
    return onFish || inMouth;
  };

  const extend = (p: { x: number; y: number } | null, starting = false) => {
    if (!p || solved) return;
    const cell = { c: Math.floor(p.x), r: Math.floor(p.y) };
    const current = pathRef.current;
    if (!current.length) {
      if (starting ? startsHere(p) : false) setPath(drawTo(maze, [maze.mouth], cell));
      return;
    }
    setPath(drawTo(maze, current, cell));
  };

  return (
    <div className="grid h-full place-items-center px-6 pb-6">
      <svg
        ref={svg}
        // Room on the left for the open mouth and whiskers, which reach out past the cat (about 4 cells at Medium).
        viewBox={`${-4.5 * (0.059 / maze.scale)} -0.6 ${maze.cols + 1 + 4.5 * (0.059 / maze.scale)} ${maze.rows + 1.2}`}
        className="maze h-full max-h-full w-full touch-none select-none"
        role="img"
        aria-label={`Cat maze: guide the fish through the cat's mouth to its tummy${solved ? ". Solved!" : ""}`}
        data-grid={grid}
        data-seed={seed}
        data-path={path.length}
        data-solved={solved}
        data-fish={`${mouth.fishHome.x},${mouth.fishHome.y}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          extend(pointFrom(e), true);
        }}
        onPointerMove={(e) => drawing.current && extend(pointFrom(e), !pathRef.current.length)}
        onPointerUp={() => {
          drawing.current = false;
          const current = pathRef.current;
          const end = current[current.length - 1];
          if (!solved && end && current.length > 1 && !maze.solution.some((s) => same(s, end))) onAttemptFailed?.();
        }}
        onPointerCancel={() => (drawing.current = false)}
      >
        <Cat maze={maze} />
        <Walls maze={maze} />
        <Face maze={maze} />

        {/* The goal: a heart on the tummy. */}
        <motion.g
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          animate={reduceMotion ? undefined : solved ? { scale: [1, 2.2, 1.6] } : { scale: [1, 1.15, 1] }}
          transition={solved ? { duration: 0.6, ease: "easeOut" } : { duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d={`M ${maze.tummy.c + 0.5} ${maze.tummy.r + 0.8} C ${maze.tummy.c - 0.1} ${maze.tummy.r + 0.35}, ${maze.tummy.c + 0.15} ${maze.tummy.r + 0.05}, ${maze.tummy.c + 0.5} ${maze.tummy.r + 0.32} C ${maze.tummy.c + 0.85} ${maze.tummy.r + 0.05}, ${maze.tummy.c + 1.1} ${maze.tummy.r + 0.35}, ${maze.tummy.c + 0.5} ${maze.tummy.r + 0.8} Z`}
            fill={COLORS.heart}
          />
        </motion.g>

        {/* The start: the fish waiting outside the mouth, in a ring that pulses until it's picked up. */}
        {!path.length && (
          <>
            <motion.circle
              cx={mouth.fishHome.x}
              cy={mouth.fishHome.y}
              r={1.3 * mouth.u}
              fill="none"
              stroke={COLORS.line}
              strokeWidth={0.14}
              animate={reduceMotion ? undefined : { r: [1.2 * mouth.u, 1.55 * mouth.u, 1.2 * mouth.u], opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            <Fish x={mouth.fishHome.x} y={mouth.fishHome.y} angle={0} size={1.25 * mouth.u} />
          </>
        )}

        {hint.map((cell, i) => (
          <circle key={`${cell.c},${cell.r}`} cx={cell.c + 0.5} cy={cell.r + 0.5} r={0.18} fill="#FFC21A" opacity={1 - i * 0.12} />
        ))}

        {path.length > 0 && (
          <g strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* The line runs from where the fish waited, in through the mouth, to the fish. Blue while drawing; green once it's home. */}
            {[
              { stroke: solved ? COLORS.done : COLORS.line, width: 0.42 },
              { stroke: solved ? COLORS.doneLight : COLORS.lineLight, width: 0.12 },
            ].map(({ stroke, width }) => (
              <polyline
                key={width}
                points={[`${mouth.fishHome.x},${mouth.y}`, `${maze.mouth.c},${mouth.y}`, ...path.map((p) => `${p.c + 0.5},${p.r + 0.5}`)].join(" ")}
                stroke={stroke}
                strokeWidth={width}
                className="transition-[stroke] duration-500"
              />
            ))}
          </g>
        )}
        {path.length > 0 && <Fish {...fishAt(path)} size={0.95} />}
      </svg>
    </div>
  );
}

/** The cat's silhouette, side-on, in cell units: ears, head and snout, a long body on four legs, a curling tail, and a cream belly. */
function Cat({ maze }: { maze: MazeData }) {
  const k = 1 / maze.scale;
  const { head, snout, body, tail, ears, legs, legTop, legBottom } = SHAPE;
  const arc = (a: number) => `${(tail.x + Math.cos(a) * tail.r) * k} ${(tail.y + Math.sin(a) * tail.r) * k}`;
  const tailPath = `M ${arc(tail.from)} A ${tail.r * k} ${tail.r * k} 0 1 0 ${arc(tail.to)}`;
  const shapes = (
    <>
      {legs.map((leg, i) => (
        <rect key={i} x={leg.x * k} y={legTop * k} width={leg.w * k} height={(legBottom - legTop) * k} rx={(leg.w / 2) * k} />
      ))}
      {ears.map((ear, i) => (
        <polygon key={i} points={ear.map(([x, y]) => `${x * k},${y * k}`).join(" ")} />
      ))}
      <ellipse cx={body.x * k} cy={body.y * k} rx={body.rx * k} ry={body.ry * k} />
      <circle cx={head.x * k} cy={head.y * k} r={head.r * k} />
      <ellipse cx={snout.x * k} cy={snout.y * k} rx={snout.rx * k} ry={snout.ry * k} />
    </>
  );
  return (
    <g strokeLinejoin="round">
      <path d={tailPath} fill="none" stroke={COLORS.furEdge} strokeWidth={tail.width * k + 0.3} strokeLinecap="round" />
      <path d={tailPath} fill="none" stroke={COLORS.fur} strokeWidth={tail.width * k} strokeLinecap="round" />
      {/* The outline first, drawn fat underneath, then the fur on top: one clean edge round the whole cat. */}
      <g fill={COLORS.furEdge} stroke={COLORS.furEdge} strokeWidth={0.5}>
        {shapes}
      </g>
      <g fill={COLORS.fur}>{shapes}</g>
      <ellipse cx={body.x * k} cy={(body.y + 0.09) * k} rx={body.rx * 0.72 * k} ry={body.ry * 0.55 * k} fill={COLORS.cream} />
      {/* Paws. */}
      {legs.map((leg, i) => (
        <ellipse key={i} cx={(leg.x + leg.w / 2) * k} cy={(legBottom - 0.02) * k} rx={(leg.w / 2 + 0.01) * k} ry={0.035 * k} fill={COLORS.cream} />
      ))}
    </g>
  );
}

/** The maze's walls: every closed side of every cell, each shared wall drawn once, and a gap at the mouth: the way in. */
function Walls({ maze }: { maze: MazeData }) {
  const lines: string[] = [];
  maze.inside.forEach((row, r) =>
    row.forEach((ok, c) => {
      if (!ok) return;
      const open = maze.open[r][c];
      const isMouth = c === maze.mouth.c && r === maze.mouth.r;
      if (!open.N) lines.push(`M${c} ${r}h1`);
      if (!open.W && !isMouth) lines.push(`M${c} ${r}v1`);
      if (!open.E && !maze.inside[r][c + 1]) lines.push(`M${c + 1} ${r}v1`);
      if (!open.S && !maze.inside[r + 1]?.[c]) lines.push(`M${c} ${r + 1}h1`);
    }),
  );
  return <path d={lines.join("")} stroke={COLORS.wall} strokeWidth={0.14} strokeLinecap="round" fill="none" />;
}

/**
 * The face: a wide-open mouth jutting out from the snout (upper and lower
 * jaw, a tongue), its dark inside narrowing to the entrance cell: the way
 * into the maze. Then the eye, the nose on top of the snout, and whiskers.
 */
function Face({ maze }: { maze: MazeData }) {
  const k = 1 / maze.scale;
  const { eyes } = SHAPE;
  const { y, u, out, inner, open } = mouthGeometry(maze);
  const jaw = (dir: 1 | -1) =>
    `M ${out - 0.2 * u} ${y + dir * (open + 0.05 * u)} Q ${(out + inner) / 2} ${y + dir * (open + 0.55 * u)} ${inner + 0.6 * u} ${y + dir * 0.9 * u} L ${inner + 0.6 * u} ${y + dir * 0.45} L ${out + 0.1 * u} ${y + dir * open} Z`;
  return (
    <g pointerEvents="none" strokeLinejoin="round">
      {/* Inside the mouth, narrowing into the maze. */}
      <path d={`M ${out} ${y - open} L ${inner} ${y - 0.42} L ${inner} ${y + 0.42} L ${out} ${y + open} Z`} fill="#6B1616" stroke={COLORS.wall} strokeWidth={0.12} />
      <ellipse cx={out + (inner - out) * 0.45} cy={y + open * 0.62} rx={(inner - out) * 0.4} ry={0.28 * u} fill="#F0508F" stroke={COLORS.wall} strokeWidth={0.08} />
      {/* Upper and lower jaw, in fur. */}
      <path d={jaw(-1)} fill={COLORS.fur} stroke={COLORS.furEdge} strokeWidth={0.22 * u} />
      <path d={jaw(1)} fill={COLORS.fur} stroke={COLORS.furEdge} strokeWidth={0.22 * u} />
      {eyes.map((e, i) => (
        <g key={i}>
          <circle cx={e.x * k} cy={e.y * k} r={e.r * k} fill="#FFFFFF" stroke={COLORS.wall} strokeWidth={0.12} />
          <circle cx={(e.x - e.r * 0.25) * k} cy={(e.y + 0.005) * k} r={e.r * 0.58 * k} fill="#14213F" />
          <circle cx={(e.x - e.r * 0.45) * k} cy={(e.y - e.r * 0.3) * k} r={e.r * 0.22 * k} fill="#FFFFFF" />
        </g>
      ))}
      {/* The nose, on top of the snout, and whiskers sweeping out from beside it. */}
      <ellipse cx={out + 0.45 * u} cy={y - open - 0.4 * u} rx={0.45 * u} ry={0.32 * u} fill="#F0508F" stroke={COLORS.wall} strokeWidth={0.08 * u} />
      <g stroke={COLORS.wall} strokeWidth={0.1 * u} strokeLinecap="round">
        {[-0.5, 0.15].map((dy) => (
          <line key={dy} x1={out + 0.6 * u} y1={y - open + (-0.15 + dy) * u} x2={out - 1.6 * u} y2={y - open + (-0.7 + dy * 2) * u} />
        ))}
      </g>
    </g>
  );
}

/**
 * Where the open mouth is, in cell units. It runs from past the cat's edge
 * (the lips) in to the entrance cell's open left side. It's sized to the cat,
 * not the grid (u is about a cell at Medium), so it looks the same at every size.
 */
function mouthGeometry(maze: MazeData) {
  const k = 1 / maze.scale;
  const y = maze.mouth.r + 0.5;
  let edge = maze.mouth.c * maze.scale;
  while (edge > 0 && insideCat(edge - 0.005, y * maze.scale)) edge -= 0.005;
  const u = k * 0.059;
  const out = edge * k - 1.1 * u;
  return { y, u, out, inner: maze.mouth.c + 0.1, open: 1.25 * u, fishHome: { x: out - 2.1 * u, y } };
}

/** The fish: silvery blue with darker fins and a big eye, facing `angle` (radians; 0 is to the right). */
function Fish({ x, y, angle, size }: { x: number; y: number; angle: number; size: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${(angle * 180) / Math.PI}) scale(${size})`} pointerEvents="none">
      <path d="M -0.55 0 L -0.95 -0.4 L -0.85 0 L -0.95 0.4 Z" fill="#2F7FC9" stroke="#14213F" strokeWidth={0.06} strokeLinejoin="round" />
      <ellipse cx={0} cy={0} rx={0.62} ry={0.36} fill="#6EC3F5" stroke="#14213F" strokeWidth={0.06} />
      <path d="M -0.1 -0.34 Q 0.05 -0.6 0.25 -0.32 Z" fill="#2F7FC9" stroke="#14213F" strokeWidth={0.05} />
      <path d="M -0.35 -0.12 Q -0.2 0 -0.35 0.12" fill="none" stroke="#2F7FC9" strokeWidth={0.07} strokeLinecap="round" />
      <ellipse cx={0.05} cy={0.12} rx={0.3} ry={0.12} fill="#FFFFFF" opacity={0.35} />
      <circle cx={0.34} cy={-0.07} r={0.11} fill="#FFFFFF" stroke="#14213F" strokeWidth={0.04} />
      <circle cx={0.37} cy={-0.07} r={0.06} fill="#14213F" />
    </g>
  );
}
