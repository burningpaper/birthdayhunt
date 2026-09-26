import { simulate } from "./engine";
import type { Level, Placed } from "./levels";
import { TURNS, piecePath, type CellRef, type PieceType, type Side } from "./track";

/**
 * Every winning route through a level. Instead of trying every way to fill
 * the board (far too many once the whole board is buildable), follow the
 * marble: from the start tube, at each empty square try each tray piece
 * that opens onto the side it arrives from, and carry on out of its other
 * opening. Each route that reaches the bucket is then rolled for real, so
 * one the marble hasn't the speed for doesn't count.
 */

const OPPOSITE: Record<Side, Side> = { L: "R", R: "L", T: "B", B: "T" };
const STEP: Record<Side, CellRef> = { L: { col: -1, row: 0 }, R: { col: 1, row: 0 }, T: { col: 0, row: -1 }, B: { col: 0, row: 1 } };
const key = (c: CellRef) => `${c.col},${c.row}`;

/** Each piece type's turns that open onto a given side, with the side it leaves by. */
function fitting(type: PieceType, enter: Side): { turns: number; leave: Side }[] {
  const out: { turns: number; leave: Side }[] = [];
  for (let turns = 0; turns < TURNS[type]; turns++) {
    const [a, b] = piecePath(type, turns).ends;
    if (a === enter) out.push({ turns, leave: b });
    else if (b === enter) out.push({ turns, leave: a });
  }
  return out;
}

export function winningRoutes(level: Level, limit = 500): Placed[][] {
  const fixed = new Map(level.fixed.map((p) => [key(p), p]));
  const open = new Set(level.open.map(key));
  const counts = new Map<PieceType, number>();
  for (const t of level.tray) counts.set(t, (counts.get(t) ?? 0) + 1);

  const wins: Placed[][] = [];
  const visit = (cell: CellRef, enter: Side, placed: Placed[], seen: Set<string>) => {
    if (wins.length >= limit) return;
    if (cell.col === level.cup.col && cell.row === level.cup.row) {
      if (enter !== "B" && simulate(level, placed).result === "cup") wins.push(placed);
      return;
    }
    const k = key(cell);
    if (seen.has(k)) return;
    const next = (leave: Side, more: Placed[]) =>
      visit({ col: cell.col + STEP[leave].col, row: cell.row + STEP[leave].row }, OPPOSITE[leave], more, new Set(seen).add(k));

    const f = fixed.get(k);
    if (f) {
      const [a, b] = piecePath(f.type, f.turns).ends;
      if (a === enter) next(b, placed);
      else if (b === enter) next(a, placed);
      return;
    }
    if (!open.has(k)) return; // a block, or off the board
    for (const [type, left] of counts) {
      if (left === 0) continue;
      for (const { turns, leave } of fitting(type, enter)) {
        counts.set(type, left - 1);
        next(leave, [...placed, { ...cell, type, turns }]);
        counts.set(type, left);
      }
    }
  };
  visit({ col: level.start, row: 0 }, "T", [], new Set());
  return wins;
}

/**
 * The hint: one piece to place next, from whichever winning route shares
 * the most with what the child has already built.
 */
export function hintPiece(routes: Placed[][], built: Placed[]): Placed | null {
  const matches = (a: Placed, b: Placed) => a.col === b.col && a.row === b.row && a.type === b.type && a.turns % TURNS[a.type] === b.turns % TURNS[b.type];
  let best: Placed[] | null = null;
  let bestScore = -1;
  for (const route of routes) {
    const score = route.filter((p) => built.some((b) => matches(p, b))).length;
    if (score > bestScore) {
      best = route;
      bestScore = score;
    }
  }
  return best?.find((p) => !built.some((b) => matches(p, b))) ?? null;
}

/**
 * How many genuinely different paths a set of routes takes. A loop and a
 * flat straight join the same two sides, so routes differing only in where
 * the loop goes are the same path.
 */
export function distinctPaths(routes: Placed[][]): number {
  const shape = (p: Placed) => `${p.col},${p.row}:${p.type === "loop" ? "straight/0" : `${p.type}/${p.turns}`}`;
  return new Set(routes.map((r) => r.map(shape).join(" "))).size;
}
