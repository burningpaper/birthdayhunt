import { seededRng } from "../random";

/**
 * The cat maze (kept free of React so it can be tested). A cat seen side-on,
 * facing left, is laid over a square grid; every cell wholly inside the cat
 * (and clear of its eye) is part of the maze. The way in is its open mouth,
 * at the cat's left edge; the way out is its tummy. A randomised depth-first
 * search carves a perfect maze through those cells: exactly one route
 * between any two, so exactly one way from the mouth to the tummy.
 *
 * Coordinates are in cells: cell (c, r) spans c..c+1 across and r..r+1 down.
 */

export type Cell = { c: number; r: number };
export type Side = "N" | "E" | "S" | "W";

/** The cat, side-on and facing left, in shape units (y down). */
export const SHAPE = {
  width: 1.82,
  height: 1.06,
  /** The size setting (15, 19 or 25) means that many cells across this width, as it always has. */
  reference: 1.12,
  head: { x: 0.36, y: 0.4, r: 0.25 },
  snout: { x: 0.15, y: 0.48, rx: 0.13, ry: 0.1 },
  ears: [
    [
      [0.22, 0.24],
      [0.2, 0.02],
      [0.37, 0.16],
    ],
    [
      [0.4, 0.17],
      [0.5, 0.0],
      [0.57, 0.23],
    ],
  ] as [number, number][][],
  body: { x: 1.0, y: 0.6, rx: 0.53, ry: 0.27 },
  legs: [
    { x: 0.6, w: 0.12 },
    { x: 0.78, w: 0.12 },
    { x: 1.14, w: 0.12 },
    { x: 1.32, w: 0.12 },
  ],
  legTop: 0.7,
  legBottom: 1.02,
  /** The tail: a band along an arc, curling up over the cat's back end. */
  tail: { x: 1.6, y: 0.42, r: 0.17, width: 0.11, from: Math.PI * 0.5, to: -Math.PI * 0.62 },
  eyes: [{ x: 0.33, y: 0.34, r: 0.05 }],
  nose: { x: 0.04, y: 0.42 },
  /** The way in: the open mouth, at the snout's left edge. */
  mouth: { x: 0.03, y: 0.53 },
  tummy: { x: 1.0, y: 0.66 },
};

function inTriangle(x: number, y: number, [a, b, c]: [number, number][]) {
  const sign = (p: [number, number], q: [number, number], r: [number, number]) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = sign([x, y], a, b);
  const d2 = sign([x, y], b, c);
  const d3 = sign([x, y], c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function inTail(x: number, y: number) {
  const t = SHAPE.tail;
  const d = Math.hypot(x - t.x, y - t.y);
  if (Math.abs(d - t.r) > t.width / 2) return false;
  const a = Math.atan2(y - t.y, x - t.x);
  return a <= t.from && a >= t.to;
}

/** Is a point (shape units) inside the cat? */
export function insideCat(x: number, y: number): boolean {
  const { head, snout, body, legs, legTop, legBottom } = SHAPE;
  if (Math.hypot(x - head.x, y - head.y) <= head.r) return true;
  if (((x - snout.x) / snout.rx) ** 2 + ((y - snout.y) / snout.ry) ** 2 <= 1) return true;
  if (((x - body.x) / body.rx) ** 2 + ((y - body.y) / body.ry) ** 2 <= 1) return true;
  if (legs.some((leg) => x >= leg.x && x <= leg.x + leg.w && y >= legTop && y <= legBottom)) return true;
  if (SHAPE.ears.some((ear) => inTriangle(x, y, ear))) return true;
  return inTail(x, y);
}

/** Does a cell (its square, in shape units) touch an eye? Those cells are the eye, not maze. */
function touchesEye(x0: number, y0: number, size: number) {
  return SHAPE.eyes.some((e) => {
    const nx = Math.max(x0, Math.min(e.x, x0 + size));
    const ny = Math.max(y0, Math.min(e.y, y0 + size));
    return Math.hypot(nx - e.x, ny - e.y) <= e.r;
  });
}

export type Maze = {
  /** The size setting it was made at (15, 19 or 25). */
  size: number;
  cols: number;
  rows: number;
  /** Shape units per cell. */
  scale: number;
  /** Which cells are part of the maze. */
  inside: boolean[][];
  /** Which sides of each cell are open (no wall). */
  open: Record<Side, boolean>[][];
  /** The way in: this cell's left side is the open mouth, at the edge of the cat. */
  mouth: Cell;
  tummy: Cell;
  /** The one route from mouth to tummy, both included. */
  solution: Cell[];
};

const STEP: Record<Side, Cell> = { N: { c: 0, r: -1 }, E: { c: 1, r: 0 }, S: { c: 0, r: 1 }, W: { c: -1, r: 0 } };
const OPPOSITE: Record<Side, Side> = { N: "S", E: "W", S: "N", W: "E" };
const SIDES: Side[] = ["N", "E", "S", "W"];

export const same = (a: Cell, b: Cell) => a.c === b.c && a.r === b.r;

/** The side of `a` that leads to its neighbour `b`, or null if they aren't neighbours. */
export function sideTowards(a: Cell, b: Cell): Side | null {
  return SIDES.find((s) => a.c + STEP[s].c === b.c && a.r + STEP[s].r === b.r) ?? null;
}

/** Can you step from `a` straight to its neighbour `b` (no wall between)? */
export function passable(maze: Maze, a: Cell, b: Cell): boolean {
  const side = sideTowards(a, b);
  return side !== null && maze.open[a.r]?.[a.c]?.[side] === true;
}

function cellAt(scale: number, x: number, y: number): Cell {
  return { c: Math.floor(x / scale), r: Math.floor(y / scale) };
}

/**
 * The cat's cells at a size setting: wholly inside the outline (so the maze
 * sits inside the cat with a border of fur round it), clear of the eye, and
 * all joined to the tummy.
 */
function catCells(size: number) {
  const scale = SHAPE.reference / size;
  const cols = Math.ceil(SHAPE.width / scale);
  const rows = Math.ceil(SHAPE.height / scale);
  const raw = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const [x0, y0, x1, y1] = [c * scale, r * scale, (c + 1) * scale, (r + 1) * scale];
      const corners = insideCat(x0, y0) && insideCat(x1, y0) && insideCat(x0, y1) && insideCat(x1, y1);
      return corners && !touchesEye(x0, y0, scale);
    }),
  );
  // Keep only what's joined to the tummy: a thin tip of ear or tail can come loose on a coarse grid.
  const tummy = cellAt(scale, SHAPE.tummy.x, SHAPE.tummy.y);
  const inside = raw.map((row) => row.map(() => false));
  const queue = [tummy];
  inside[tummy.r][tummy.c] = true;
  while (queue.length) {
    const cell = queue.shift()!;
    for (const s of SIDES) {
      const n = { c: cell.c + STEP[s].c, r: cell.r + STEP[s].r };
      if (raw[n.r]?.[n.c] && !inside[n.r][n.c]) {
        inside[n.r][n.c] = true;
        queue.push(n);
      }
    }
  }
  return { scale, cols, rows, inside, tummy };
}

/** The maze cell nearest a point in shape units (so the mouth lands on a real cell even if its exact spot isn't one). */
function nearestCell(inside: boolean[][], scale: number, x: number, y: number): Cell {
  let best: Cell = { c: 0, r: 0 };
  let bestD = Infinity;
  inside.forEach((row, r) =>
    row.forEach((ok, c) => {
      const d = ok ? Math.hypot((c + 0.5) * scale - x, (r + 0.5) * scale - y) : Infinity;
      if (d < bestD) {
        bestD = d;
        best = { c, r };
      }
    }),
  );
  return best;
}

function carve(inside: boolean[][], cols: number, rows: number, start: Cell, rng: () => number) {
  const open = inside.map((row) => row.map(() => ({ N: false, E: false, S: false, W: false })));
  const seen = inside.map((row) => row.map(() => false));
  const stack = [start];
  seen[start.r][start.c] = true;
  while (stack.length) {
    const cell = stack[stack.length - 1];
    const options = SIDES.filter((s) => {
      const n = { c: cell.c + STEP[s].c, r: cell.r + STEP[s].r };
      return n.c >= 0 && n.c < cols && n.r >= 0 && n.r < rows && inside[n.r][n.c] && !seen[n.r][n.c];
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const s = options[Math.floor(rng() * options.length)];
    const n = { c: cell.c + STEP[s].c, r: cell.r + STEP[s].r };
    open[cell.r][cell.c][s] = true;
    open[n.r][n.c][OPPOSITE[s]] = true;
    seen[n.r][n.c] = true;
    stack.push(n);
  }
  return open;
}

/** The shortest (in a perfect maze, the only) route between two cells. */
export function route(maze: Pick<Maze, "open" | "cols" | "rows">, from: Cell, to: Cell): Cell[] {
  const prev = new Map<string, Cell | null>([[`${from.c},${from.r}`, null]]);
  const queue = [from];
  while (queue.length) {
    const cell = queue.shift()!;
    if (same(cell, to)) break;
    for (const s of SIDES) {
      if (!maze.open[cell.r][cell.c][s]) continue;
      const n = { c: cell.c + STEP[s].c, r: cell.r + STEP[s].r };
      const k = `${n.c},${n.r}`;
      if (!prev.has(k)) {
        prev.set(k, cell);
        queue.push(n);
      }
    }
  }
  const path: Cell[] = [];
  for (let cell: Cell | null | undefined = to; cell; cell = prev.get(`${cell.c},${cell.r}`)) path.unshift(cell);
  return same(path[0], from) ? path : [];
}

/**
 * The maze for a station, at a size setting. A few attempts from the seed, keeping the first
 * whose route from mouth to tummy is satisfyingly long (at least a quarter of
 * all cells); the same seed and size always give the same maze.
 */
export function makeMaze(size: number, seed: number): Maze {
  const { scale, cols, rows, inside, tummy } = catCells(size);
  const mouth = nearestCell(inside, scale, SHAPE.mouth.x, SHAPE.mouth.y);
  const total = inside.flat().filter(Boolean).length;
  let best: Maze | null = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const open = carve(inside, cols, rows, tummy, seededRng(seed + attempt * 7919));
    const solution = route({ open, cols, rows }, mouth, tummy);
    const maze: Maze = { size, cols, rows, scale, inside, open, mouth, tummy, solution };
    if (!best || solution.length > best.solution.length) best = maze;
    if (solution.length >= total / 4) return maze;
  }
  return best!;
}

/**
 * Where a finger has gone, as a path of cells: extend to a cell reached
 * through open passages (a quick swipe may skip a few, so up to `reach`
 * steps are filled in along the corridors), or rub back to a cell already
 * on the path. Anything else (through a wall, or too far) leaves it as it is.
 */
export function drawTo(maze: Maze, path: Cell[], cell: Cell, reach = 4): Cell[] {
  if (!maze.inside[cell.r]?.[cell.c]) return path;
  const back = path.findIndex((p) => same(p, cell));
  if (back >= 0) return path.slice(0, back + 1);
  const end = path[path.length - 1];
  const way = route(maze, end, cell);
  if (way.length < 2 || way.length - 1 > reach) return path;
  // Never cross the path already drawn.
  if (way.slice(1).some((w) => path.some((p) => same(p, w)))) return path;
  return [...path, ...way.slice(1)];
}
