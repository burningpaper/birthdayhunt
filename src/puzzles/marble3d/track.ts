/**
 * The marble run's board and pieces, as geometry. One unit is one grid cell.
 * The board is `cols` × `rows` cells standing upright; x runs right, y runs
 * UP (three.js's way), z comes out of the board towards the player.
 *
 * Every piece fills exactly one cell and opens onto the middle of its
 * edges: the ports. Two pieces side by side meet at the same point, so a
 * run built from them has no gaps by construction.
 */

export type Vec3 = { x: number; y: number; z: number };
export type Side = "L" | "R" | "T" | "B";
export type PieceType = "straight" | "curve" | "loop";
export type CellRef = { col: number; row: number };

export const PIECE_TYPES: PieceType[] = ["straight", "curve", "loop"];

/** Sizes, in cells. */
export const MARBLE_RADIUS = 0.12;
export const TUBE_RADIUS = 0.15;
/** The loop sits wholly inside its own cell: the track dips to its foot, goes round, and climbs back out. */
const LOOP_RADIUS = 0.3;
const LOOP_FOOT = -0.38;
/** How far the loop's two crossing strands sit apart, front to back: just clear of each other. */
const LOOP_SPLIT = TUBE_RADIUS * 2 + 0.04;

const PORT: Record<Side, Vec3> = {
  L: { x: -0.5, y: 0, z: 0 },
  R: { x: 0.5, y: 0, z: 0 },
  T: { x: 0, y: 0.5, z: 0 },
  B: { x: 0, y: -0.5, z: 0 },
};

/** A quarter turn anticlockwise (as seen by the player) moves each opening round one side. */
const TURN_SIDE: Record<Side, Side> = { L: "B", B: "R", R: "T", T: "L" };

/** How many different ways round each piece can be turned. */
export const TURNS: Record<PieceType, number> = { straight: 2, curve: 4, loop: 1 };

/** A piece's centre line in its own cell space (origin at the cell centre), from its first port to its second. */
export type PiecePath = { ends: [Side, Side]; points: Vec3[] };

function line(a: Vec3, b: Vec3, steps: number): Vec3[] {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    x: a.x + ((b.x - a.x) * i) / steps,
    y: a.y + ((b.y - a.y) * i) / steps,
    z: a.z + ((b.z - a.z) * i) / steps,
  }));
}

/** Left to bottom: a quarter circle about the bottom-left corner. */
function curvePoints(): Vec3[] {
  const steps = 16;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = Math.PI / 2 - (i / steps) * (Math.PI / 2);
    return { x: -0.5 + 0.5 * Math.cos(a), y: -0.5 + 0.5 * Math.sin(a), z: 0 };
  });
}

/** A smooth S-bend between two points, leaving and arriving level. */
function sBend(a: Vec3, b: Vec3, steps: number): Vec3[] {
  const p1 = { x: a.x + (b.x - a.x) * 0.45, y: a.y, z: a.z };
  const p2 = { x: a.x + (b.x - a.x) * 0.55, y: b.y, z: b.z };
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    const mix = (k: "x" | "y" | "z") => u * u * u * a[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * b[k];
    return { x: mix("x"), y: mix("y"), z: mix("z") };
  });
}

/**
 * Left to right, dipping into a loop-the-loop. The strand going in passes
 * behind the strand coming out, so the loop leans slightly, like a real
 * plastic one.
 */
function loopPoints(): Vec3[] {
  const back = -LOOP_SPLIT / 2;
  const front = LOOP_SPLIT / 2;
  const into = sBend(PORT.L, { x: 0, y: LOOP_FOOT, z: back }, 14);
  const steps = 40;
  const loop = Array.from({ length: steps + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    return { x: LOOP_RADIUS * Math.cos(a), y: LOOP_FOOT + LOOP_RADIUS + LOOP_RADIUS * Math.sin(a), z: back + (front - back) * (i / steps) };
  });
  const out = sBend({ x: 0, y: LOOP_FOOT, z: front }, PORT.R, 14);
  return [...into, ...loop.slice(1), ...out.slice(1)];
}

const BASE: Record<PieceType, PiecePath> = {
  straight: { ends: ["L", "R"], points: line(PORT.L, PORT.R, 4) },
  curve: { ends: ["L", "B"], points: curvePoints() },
  loop: { ends: ["L", "R"], points: loopPoints() },
};

function turnSide(side: Side, turns: number): Side {
  let s = side;
  for (let i = 0; i < turns; i++) s = TURN_SIDE[s];
  return s;
}

/** Normalise a turn count to 0 … TURNS-1. */
export function normalTurns(type: PieceType, turns: number): number {
  const n = TURNS[type];
  return ((turns % n) + n) % n;
}

/** A piece's path, turned `turns` quarter turns anticlockwise, in its own cell space. */
export function piecePath(type: PieceType, turns: number): PiecePath {
  const t = normalTurns(type, turns);
  const base = BASE[type];
  const a = (t * Math.PI) / 2;
  const cos = Math.round(Math.cos(a));
  const sin = Math.round(Math.sin(a));
  return {
    ends: [turnSide(base.ends[0], t), turnSide(base.ends[1], t)],
    points: base.points.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos, z: p.z })),
  };
}

/** The centre of a cell in board space. Row 0 is the top row. */
export function cellCentre(cell: CellRef, rows: number): Vec3 {
  return { x: cell.col + 0.5, y: rows - cell.row - 0.5, z: 0 };
}

/** A piece's path moved into board space. */
export function placedPath(type: PieceType, turns: number, cell: CellRef, rows: number): PiecePath {
  const c = cellCentre(cell, rows);
  const path = piecePath(type, turns);
  return { ends: path.ends, points: path.points.map((p) => ({ x: p.x + c.x, y: p.y + c.y, z: p.z })) };
}

/** The point where a cell opens onto a side, in board space. */
export function portPoint(cell: CellRef, side: Side, rows: number): Vec3 {
  const c = cellCentre(cell, rows);
  return { x: c.x + PORT[side].x, y: c.y + PORT[side].y, z: 0 };
}
