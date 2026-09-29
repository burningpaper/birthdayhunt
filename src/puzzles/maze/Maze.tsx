"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { snap } from "@/lib/audio/sfx";
import type { PuzzleProps } from "../types";
import { SHAPE, drawTo, makeMaze, same, type Cell, type Maze as MazeData } from "./logic";

const HINT_MS = 4000;
const HINT_CELLS = 6;
const COLORS = { fur: "#FF9A3C", furEdge: "#C2570C", cream: "#FFE7C2", wall: "#5B2A0A", line: "#2F6BEA", lineLight: "#9CC0FF", done: "#22A94F", doneLight: "#9BE3B2", heart: "#F0453A" };

/** How far along the true route a path is before it strays. */
function correctPrefix(path: Cell[], solution: Cell[]) {
  let n = 0;
  while (n < path.length && n < solution.length && same(path[n], solution[n])) n++;
  return n;
}

/**
 * Cat Maze: draw a line with a finger from the cat's mouth to its tummy. The
 * line keeps to the corridors (a quick swipe fills in the corridor it
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

  const cellFrom = (event: ReactPointerEvent): Cell | null => {
    const el = svg.current;
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { c: Math.floor(p.x), r: Math.floor(p.y) };
  };

  /** A path starts at the mouth: a touch on (or right beside) it. */
  const nearMouth = (cell: Cell) => Math.abs(cell.c - maze.mouth.c) <= 1 && Math.abs(cell.r - maze.mouth.r) <= 1;

  const extend = (cell: Cell | null) => {
    if (!cell || solved) return;
    const current = pathRef.current;
    if (!current.length) {
      if (nearMouth(cell)) setPath(drawTo(maze, [maze.mouth], cell));
      return;
    }
    setPath(drawTo(maze, current, cell));
  };

  return (
    <div className="grid h-full place-items-center px-6 pb-6">
      <svg
        ref={svg}
        viewBox={`-2 -0.6 ${maze.cols + 4} ${maze.rows + 1.2}`}
        className="maze h-full max-h-full w-full touch-none select-none"
        role="img"
        aria-label={`Cat maze: draw from the cat's mouth to its tummy${solved ? ". Solved!" : ""}`}
        data-grid={grid}
        data-seed={seed}
        data-path={path.length}
        data-solved={solved}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          extend(cellFrom(e));
        }}
        onPointerMove={(e) => drawing.current && extend(cellFrom(e))}
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

        {/* The start: a ring at the mouth, pulsing until the drawing begins. */}
        {!path.length && (
          <motion.circle
            cx={maze.mouth.c + 0.5}
            cy={maze.mouth.r + 0.5}
            r={0.42}
            fill="none"
            stroke={COLORS.line}
            strokeWidth={0.14}
            animate={reduceMotion ? undefined : { r: [0.35, 0.6, 0.35], opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        )}

        {hint.map((cell, i) => (
          <circle key={`${cell.c},${cell.r}`} cx={cell.c + 0.5} cy={cell.r + 0.5} r={0.18} fill="#FFC21A" opacity={1 - i * 0.12} />
        ))}

        {path.length > 0 && (
          <g strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Blue while drawing; green once it reaches the tummy. */}
            <polyline points={path.map((p) => `${p.c + 0.5},${p.r + 0.5}`).join(" ")} stroke={solved ? COLORS.done : COLORS.line} strokeWidth={0.42} className="transition-[stroke] duration-500" />
            <polyline points={path.map((p) => `${p.c + 0.5},${p.r + 0.5}`).join(" ")} stroke={solved ? COLORS.doneLight : COLORS.lineLight} strokeWidth={0.12} className="transition-[stroke] duration-500" />
            {!solved && <circle cx={path[path.length - 1].c + 0.5} cy={path[path.length - 1].r + 0.5} r={0.3} fill={COLORS.line} stroke="#FFFFFF" strokeWidth={0.08} />}
          </g>
        )}
      </svg>
    </div>
  );
}

/** The cat's silhouette, in cell units: ears, head, body, a curling tail, and a cream tummy. */
function Cat({ maze }: { maze: MazeData }) {
  const k = 1 / maze.scale;
  const { head, body, tail, ears } = SHAPE;
  const arc = (a: number) => `${(tail.x + Math.cos(a) * tail.r) * k} ${(tail.y + Math.sin(a) * tail.r) * k}`;
  return (
    <g stroke={COLORS.furEdge} strokeWidth={0.22} strokeLinejoin="round">
      <path d={`M ${arc(tail.from)} A ${tail.r * k} ${tail.r * k} 0 0 0 ${arc(tail.to)}`} fill="none" stroke={COLORS.furEdge} strokeWidth={tail.width * k + 0.3} strokeLinecap="round" />
      <path d={`M ${arc(tail.from)} A ${tail.r * k} ${tail.r * k} 0 0 0 ${arc(tail.to)}`} fill="none" stroke={COLORS.fur} strokeWidth={tail.width * k} strokeLinecap="round" />
      {ears.map((ear, i) => (
        <polygon key={i} points={ear.map(([x, y]) => `${x * k},${y * k}`).join(" ")} fill={COLORS.fur} />
      ))}
      <ellipse cx={body.x * k} cy={body.y * k} rx={body.rx * k} ry={body.ry * k} fill={COLORS.fur} />
      <circle cx={head.x * k} cy={head.y * k} r={head.r * k} fill={COLORS.fur} />
      <ellipse cx={body.x * k} cy={(body.y + 0.03) * k} rx={body.rx * 0.62 * k} ry={body.ry * 0.7 * k} fill={COLORS.cream} stroke="none" />
    </g>
  );
}

/** The maze's walls: every closed side of every cell, each shared wall drawn once. */
function Walls({ maze }: { maze: MazeData }) {
  const lines: string[] = [];
  maze.inside.forEach((row, r) =>
    row.forEach((ok, c) => {
      if (!ok) return;
      const open = maze.open[r][c];
      if (!open.N) lines.push(`M${c} ${r}h1`);
      if (!open.W) lines.push(`M${c} ${r}v1`);
      if (!open.E && !maze.inside[r][c + 1]) lines.push(`M${c + 1} ${r}v1`);
      if (!open.S && !maze.inside[r + 1]?.[c]) lines.push(`M${c} ${r + 1}h1`);
    }),
  );
  return <path d={lines.join("")} stroke={COLORS.wall} strokeWidth={0.14} strokeLinecap="round" fill="none" />;
}

/** Eyes the maze winds round, a nose, and whiskers. */
function Face({ maze }: { maze: MazeData }) {
  const k = 1 / maze.scale;
  const { eyes, nose, head } = SHAPE;
  return (
    <g pointerEvents="none">
      {eyes.map((e, i) => (
        <g key={i}>
          <circle cx={e.x * k} cy={e.y * k} r={e.r * k} fill="#FFFFFF" stroke={COLORS.wall} strokeWidth={0.12} />
          <circle cx={e.x * k} cy={(e.y + 0.01) * k} r={e.r * 0.55 * k} fill="#14213F" />
          <circle cx={(e.x - e.r * 0.25) * k} cy={(e.y - e.r * 0.25) * k} r={e.r * 0.2 * k} fill="#FFFFFF" />
        </g>
      ))}
      <path d={`M ${(nose.x - 0.035) * k} ${(nose.y - 0.018) * k} L ${(nose.x + 0.035) * k} ${(nose.y - 0.018) * k} L ${nose.x * k} ${(nose.y + 0.025) * k} Z`} fill="#F0508F" stroke={COLORS.wall} strokeWidth={0.06} />
      <g stroke={COLORS.wall} strokeWidth={0.1} strokeLinecap="round">
        {[-1, 1].map((side) =>
          [-0.03, 0.02].map((dy) => (
            <line
              key={`${side},${dy}`}
              x1={(head.x + side * (head.r - 0.03)) * k}
              y1={(nose.y + dy) * k}
              x2={(head.x + side * (head.r + 0.11)) * k}
              y2={(nose.y + dy * 2.2) * k}
            />
          )),
        )}
      </g>
    </g>
  );
}
