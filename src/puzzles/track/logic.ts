/**
 * Fix the Train Track (spec §6.3), as pure functions.
 *
 * Each tile connects some of its four sides, stored as a bit mask
 * (N=1, E=2, S=4, W=8). Rotating a tile a quarter turn clockwise moves
 * every bit one side round. The train leaves a station on the left edge
 * and must reach the building on the right edge.
 *
 * Generation builds a real path first, fills the rest with random tiles,
 * then spins everything, so there is always at least one solution.
 */

import { shuffle, type Rng } from "../random";

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const SIDES = [N, E, S, W] as const;

export type Kind = "straight" | "curve" | "cross";
export type Tile = { kind: Kind; turns: number };
export type Pos = { x: number; y: number };
export type Board = { size: number; tiles: Tile[][]; startRow: number; endRow: number };

const BASE: Record<Kind, number> = { straight: N | S, curve: N | E, cross: N | E | S | W };

const STEP: Record<number, Pos> = { [N]: { x: 0, y: -1 }, [E]: { x: 1, y: 0 }, [S]: { x: 0, y: 1 }, [W]: { x: -1, y: 0 } };

export function opposite(side: number): number {
  return side === N ? S : side === S ? N : side === E ? W : E;
}

/** Rotate a mask a number of quarter turns clockwise. */
export function rotateMask(mask: number, turns: number): number {
  let m = mask;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

export function connections(tile: Tile): number {
  return rotateMask(BASE[tile.kind], tile.turns);
}

/** Where the train leaves a tile it entered through `entry`, or null if the track doesn't carry it. */
export function exitSide(tile: Tile, entry: number): number | null {
  const mask = connections(tile);
  if (!(mask & entry)) return null;
  if (tile.kind === "cross") return opposite(entry);
  return mask & ~entry;
}

/** The turns that make a tile connect exactly `need` (e.g. W|E), or null if it can't. */
export function turnsFor(kind: Kind, need: number): number | null {
  for (let t = 0; t < 4; t++) {
    const mask = rotateMask(BASE[kind], t);
    if (kind === "cross" ? (mask & need) === need : mask === need) return t;
  }
  return null;
}

export type Trace = { cells: (Pos & { entry: number; exit: number })[]; solved: boolean };

/** Follow the track from the station for as long as it holds together. */
export function trace(board: Board): Trace {
  const cells: Trace["cells"] = [];
  let pos: Pos = { x: 0, y: board.startRow };
  let entry = W;
  for (let guard = 0; guard < board.size * board.size * 2; guard++) {
    const tile = board.tiles[pos.y]?.[pos.x];
    if (!tile) break;
    const exit = exitSide(tile, entry);
    if (exit === null) break;
    cells.push({ ...pos, entry, exit });
    const next = { x: pos.x + STEP[exit].x, y: pos.y + STEP[exit].y };
    const offBoard = next.x < 0 || next.y < 0 || next.x >= board.size || next.y >= board.size;
    if (offBoard) return { cells, solved: exit === E && pos.x === board.size - 1 && pos.y === board.endRow };
    pos = next;
    entry = opposite(exit);
  }
  return { cells, solved: false };
}

// ---------- Generation ----------

/** A random self-avoiding route from the left-edge station to the right-edge building. */
function randomRoute(size: number, startRow: number, endRow: number, minLength: number, rng: Rng): Pos[] | null {
  const seen = new Set<string>();
  const route: Pos[] = [];
  let budget = 5000;

  const walk = (pos: Pos): boolean => {
    if (--budget < 0) return false;
    route.push(pos);
    seen.add(`${pos.x},${pos.y}`);
    if (pos.x === size - 1 && pos.y === endRow && route.length >= minLength) return true;
    for (const side of shuffle([...SIDES], rng)) {
      const next = { x: pos.x + STEP[side].x, y: pos.y + STEP[side].y };
      if (next.x < 0 || next.y < 0 || next.x >= size || next.y >= size || seen.has(`${next.x},${next.y}`)) continue;
      if (walk(next)) return true;
    }
    route.pop();
    seen.delete(`${pos.x},${pos.y}`);
    return false;
  };

  return walk({ x: 0, y: startRow }) ? route : null;
}

function sideBetween(from: Pos, to: Pos): number {
  if (to.x > from.x) return E;
  if (to.x < from.x) return W;
  return to.y > from.y ? S : N;
}

export type Puzzle = { board: Board; route: Pos[] };

/**
 * A new puzzle: a winding route (at least a grid-and-a-half long so it isn't
 * a straight dash), random decoys everywhere else, all tiles spun, and never
 * already solved.
 */
export function generate(size: number, rng: Rng): Puzzle {
  const startRow = Math.floor(rng() * size);
  const endRow = Math.floor(rng() * size);
  const minLength = Math.floor(size * 1.5);
  let route: Pos[] | null = null;
  for (let attempt = 0; !route && attempt < 50; attempt++) route = randomRoute(size, startRow, endRow, minLength, rng);
  route ??= randomRoute(size, startRow, endRow, size, rng)!;

  const tiles: Tile[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => {
      const roll = rng();
      const kind: Kind = roll < 0.45 ? "straight" : roll < 0.9 ? "curve" : "cross";
      return { kind, turns: Math.floor(rng() * 4) };
    }),
  );

  route.forEach((pos, i) => {
    const entry = i === 0 ? W : sideBetween(pos, route![i - 1]);
    const exit = i === route!.length - 1 ? E : sideBetween(pos, route![i + 1]);
    const kind: Kind = entry === opposite(exit) ? "straight" : "curve";
    tiles[pos.y][pos.x] = { kind, turns: Math.floor(rng() * 4) };
  });

  const board: Board = { size, tiles, startRow, endRow };
  // Spinning can, rarely, land on the answer; spin again until it doesn't.
  for (let guard = 0; trace(board).solved && guard < 20; guard++) {
    for (const pos of route) board.tiles[pos.y][pos.x].turns += 1 + Math.floor(rng() * 3);
  }
  return { board, route };
}

/** For each cell on `route`, the connection it needs. */
export function routeNeeds(route: Pos[]): Map<string, number> {
  const needs = new Map<string, number>();
  route.forEach((pos, i) => {
    const entry = i === 0 ? W : sideBetween(pos, route[i - 1]);
    const exit = i === route.length - 1 ? E : sideBetween(pos, route[i + 1]);
    needs.set(`${pos.x},${pos.y}`, entry | exit);
  });
  return needs;
}

/**
 * Any working route for a board's tile kinds (depth-first over rotations).
 * Used by tests to prove every puzzle is solvable, and by the E2E solver.
 */
export function findSolution(kinds: Kind[][], startRow: number, endRow: number): Map<string, number> | null {
  const size = kinds.length;
  const used = new Set<string>();
  const needs = new Map<string, number>();

  const visit = (pos: Pos, entry: number): boolean => {
    const key = `${pos.x},${pos.y}`;
    if (used.has(key)) return false;
    const kind = kinds[pos.y][pos.x];
    const exits = kind === "cross" ? [opposite(entry)] : SIDES.filter((s) => s !== entry && turnsFor(kind, entry | s) !== null);
    used.add(key);
    for (const exit of exits) {
      needs.set(key, entry | exit);
      const next = { x: pos.x + STEP[exit].x, y: pos.y + STEP[exit].y };
      const offBoard = next.x < 0 || next.y < 0 || next.x >= size || next.y >= size;
      if (offBoard) {
        if (exit === E && pos.x === size - 1 && pos.y === endRow) return true;
        continue;
      }
      if (visit(next, opposite(exit))) return true;
    }
    used.delete(key);
    needs.delete(key);
    return false;
  };

  return visit({ x: 0, y: startRow }, W) ? needs : null;
}

/** Apply a solution's needs to a board (what the E2E solver clicks towards). */
export function applySolution(board: Board, needs: Map<string, number>): Board {
  const tiles = board.tiles.map((row, y) =>
    row.map((tile, x) => {
      const need = needs.get(`${x},${y}`);
      return need === undefined ? tile : { ...tile, turns: turnsFor(tile.kind, need)! };
    }),
  );
  return { ...board, tiles };
}
