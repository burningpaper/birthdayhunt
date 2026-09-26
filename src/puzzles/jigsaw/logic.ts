/**
 * Jigsaw geometry, kept free of React so it can be tested (spec §6.1).
 *
 * Every internal edge gets a random tab direction. A piece reads the shared
 * edge from both sides with opposite signs, so a tab on one piece is always
 * a matching hole on its neighbour.
 */

import { shuffle, type Rng } from "../random";

export { seededRng, shuffle, type Rng } from "../random";

// ---------- Grid and tabs ----------

export type PieceCount = 6 | 9 | 12 | 15 | 16 | 20;

export function gridFor(pieces: PieceCount, aspect: number): { cols: number; rows: number } {
  const landscape = { 6: [3, 2], 9: [3, 3], 12: [4, 3], 15: [5, 3], 16: [4, 4], 20: [5, 4] }[pieces];
  const [cols, rows] = aspect >= 1 ? landscape : [landscape[1], landscape[0]];
  return { cols, rows };
}

/** +1: the tab sticks out of the first piece (above / left). -1: into it. */
export type Tabs = { horizontal: number[][]; vertical: number[][] };

export function makeTabs(cols: number, rows: number, rng: Rng): Tabs {
  const coin = () => (rng() < 0.5 ? 1 : -1);
  return {
    // Between row r and r+1, at column c.
    horizontal: Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, coin)),
    // Between column c and c+1, on row r.
    vertical: Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, coin)),
  };
}

/** Each side of one piece: 1 tab out, -1 hole, 0 flat border. */
export type Sides = { top: number; right: number; bottom: number; left: number };

export function pieceSides(col: number, row: number, tabs: Tabs): Sides {
  const rows = tabs.vertical.length;
  const cols = tabs.horizontal[0]?.length ?? (tabs.vertical[0]?.length ?? 0) + 1;
  return {
    top: row === 0 ? 0 : -tabs.horizontal[row - 1][col],
    bottom: row === rows - 1 ? 0 : tabs.horizontal[row][col],
    left: col === 0 ? 0 : -tabs.vertical[row][col - 1],
    right: col === cols - 1 ? 0 : tabs.vertical[row][col],
  };
}

// ---------- Piece outlines ----------

/** The classic tab profile: (u along the edge 0..1, v outward 0..1). */
const TAB_CURVES: [number, number][][] = [
  [[0.41, 0], [0.42, 0.25], [0.38, 0.45]],
  [[0.33, 0.75], [0.4, 1], [0.5, 1]],
  [[0.6, 1], [0.67, 0.75], [0.62, 0.45]],
  [[0.58, 0.25], [0.59, 0], [0.63, 0]],
];
const NECK_START = 0.37;

type Point = [number, number];
const fmt = (n: number) => Number(n.toFixed(2));

/**
 * One edge from p0 to p1, as SVG commands (no leading M). `normal` points
 * out of the piece; `tab` is 1, -1 or 0; `depth` is how far a tab reaches.
 */
function edgeCommands(p0: Point, p1: Point, normal: Point, tab: number, depth: number): string {
  if (tab === 0) return `L${fmt(p1[0])},${fmt(p1[1])}`;
  const d: Point = [p1[0] - p0[0], p1[1] - p0[1]];
  const at = (u: number, v: number): string =>
    `${fmt(p0[0] + d[0] * u + normal[0] * v * depth * tab)},${fmt(p0[1] + d[1] * u + normal[1] * v * depth * tab)}`;

  const curves = TAB_CURVES.map((points) => `C${points.map(([u, v]) => at(u, v)).join(" ")}`).join(" ");
  return `L${at(NECK_START, 0)} ${curves} L${fmt(p1[0])},${fmt(p1[1])}`;
}

/** A closed outline for a w×h piece whose top-left corner is (0,0). */
export function piecePath(w: number, h: number, sides: Sides, depth: number): string {
  return [
    "M0,0",
    edgeCommands([0, 0], [w, 0], [0, -1], sides.top, depth),
    edgeCommands([w, 0], [w, h], [1, 0], sides.right, depth),
    edgeCommands([w, h], [0, h], [0, 1], sides.bottom, depth),
    edgeCommands([0, h], [0, 0], [-1, 0], sides.left, depth),
    "Z",
  ].join(" ");
}

/** How far tabs reach, relative to the piece. */
export function tabDepth(cellW: number, cellH: number): number {
  return 0.28 * Math.min(cellW, cellH);
}

// ---------- Layout ----------

export type Rect = { x: number; y: number; w: number; h: number };
export type Layout = { board: Rect; cellW: number; cellH: number; depth: number; width: number; height: number };

const MARGIN = 8;
/**
 * Planned overlap between neighbouring loose pieces (as a share of their
 * size). The small random jitter can add a few percent on top of this.
 */
const MAX_OVERLAP = 0.2;

type SidePlan = { from: number; to: number; count: number; columns: 1 | 2; rows: number };

function boxOf(cellW: number, cellH: number, depth: number) {
  return { w: cellW + depth * 2, h: cellH + depth * 2 };
}

/** How the loose pieces stack down each side of the board, and whether that fits. */
function planSides(width: number, height: number, board: Rect, box: { w: number; h: number }, count: number) {
  const sides: SidePlan[] = [
    { from: MARGIN, to: board.x - MARGIN, count: Math.ceil(count / 2), columns: 1, rows: 0 },
    { from: board.x + board.w + MARGIN, to: width - MARGIN, count: Math.floor(count / 2), columns: 1, rows: 0 },
  ];
  const minStep = box.h * (1 - MAX_OVERLAP);
  let fits = true;
  for (const side of sides) {
    const stripW = side.to - side.from;
    const oneColumnRows = side.count;
    const twoColumnRows = Math.ceil(side.count / 2);
    // `stagger` is the half-row offset used when a side has two columns.
    const verticalFits = (rows: number, stagger = 0) => rows + stagger <= 1 || box.h + (rows - 1 + stagger) * minStep <= height - MARGIN * 2;
    const roomForTwo = stripW >= box.w * 2 && verticalFits(twoColumnRows, 0.5);
    if (!roomForTwo && verticalFits(oneColumnRows) && stripW >= box.w) {
      side.columns = 1;
      side.rows = oneColumnRows;
    } else {
      side.columns = 2;
      side.rows = twoColumnRows;
      // Two columns may overlap sideways by the same share, but must still fit the strip.
      if (!verticalFits(twoColumnRows, 0.5) || stripW < box.w * (2 - MAX_OVERLAP)) fits = false;
    }
    if (stripW < box.w) fits = false;
  }
  return { sides, fits };
}

/**
 * Board size and position. It starts at half the width and shrinks until the
 * loose pieces fit down both sides without burying each other, so every
 * piece stays easy to grab.
 */
export function computeLayout(width: number, height: number, aspect: number, cols: number, rows: number): Layout {
  const count = cols * rows;
  let best: Layout | null = null;
  for (let scale = 1; scale >= 0.4; scale -= 0.04) {
    let w = width * 0.5 * scale;
    let h = w / aspect;
    if (h > height * 0.86 * scale) {
      h = height * 0.86 * scale;
      w = h * aspect;
    }
    const board = { x: (width - w) / 2, y: (height - h) / 2, w, h };
    const cellW = w / cols;
    const cellH = h / rows;
    const depth = tabDepth(cellW, cellH);
    best = { board, cellW, cellH, depth, width, height };
    if (planSides(width, height, board, boxOf(cellW, cellH, depth), count).fits) break;
  }
  return best!;
}

export function homeOf(layout: Layout, col: number, row: number): { x: number; y: number } {
  return { x: layout.board.x + col * layout.cellW, y: layout.board.y + row * layout.cellH };
}

/**
 * Starting spots for the loose pieces, down both sides of the board, shuffled
 * and jittered a little so they look tipped out of a box. Positions are piece
 * origins (the cell's top-left corner, inside the tabs).
 */
export function scatter(layout: Layout, count: number, rng: Rng): { x: number; y: number }[] {
  const { board, cellW, cellH, depth, width, height } = layout;
  const box = boxOf(cellW, cellH, depth);
  const { sides } = planSides(width, height, board, box, count);
  const slots: { x: number; y: number }[] = [];

  for (const side of sides) {
    const usableH = Math.max(0, height - box.h - MARGIN * 2);
    // Two columns are staggered by half a row, like bricks, so neighbours barely overlap.
    const stagger = side.columns === 2 ? 0.5 : 0;
    const stepY = side.rows - 1 + stagger > 0 ? usableH / (side.rows - 1 + stagger) : 0;
    const lastX = Math.max(side.from, side.to - box.w);
    for (let i = 0; i < side.count; i++) {
      const column = side.columns === 1 ? 0 : i % 2;
      const row = side.columns === 1 ? i : Math.floor(i / 2);
      const x = side.columns === 1 ? (side.from + lastX) / 2 : column === 0 ? side.from : lastX;
      const centredY = stepY > 0 ? MARGIN + row * stepY + (column === 1 ? stepY * stagger : 0) : (height - box.h) / 2;
      slots.push({ x, y: centredY });
    }
  }

  const jitter = () => (rng() - 0.5) * 12;
  return shuffle(slots, rng).map((slot) => ({
    x: clamp(slot.x + jitter(), 0, width - box.w) + depth,
    y: clamp(slot.y + jitter(), 0, height - box.h) + depth,
  }));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// ---------- Snapping ----------

export const SNAP_DISTANCE = 30;

/** Close enough (and the right way up) to click into place. */
export function shouldSnap(pos: { x: number; y: number }, home: { x: number; y: number }, quarterTurns: number): boolean {
  return quarterTurns % 4 === 0 && Math.hypot(pos.x - home.x, pos.y - home.y) <= SNAP_DISTANCE;
}

/** Whether a drop landed on the board at all (a miss there counts as an attempt). */
export function isOverBoard(pos: { x: number; y: number }, layout: Layout): boolean {
  const cx = pos.x + layout.cellW / 2;
  const cy = pos.y + layout.cellH / 2;
  const { board } = layout;
  return cx >= board.x && cx <= board.x + board.w && cy >= board.y && cy <= board.y + board.h;
}
