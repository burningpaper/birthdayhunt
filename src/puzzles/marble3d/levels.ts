import type { CellRef, PieceType } from "./track";

/**
 * Marble run levels, as data. The marble drops from a tube above the top
 * row at column `start`, straight down into that cell. `fixed` pieces are
 * screwed to the board and `blocked` cells hold a chunky block; every other
 * cell (`open`, worked out from those) is the child's to build on. `tray`
 * lists the pieces on offer: just enough to reach the bucket, so the route
 * has to be planned, not just joined up. `solution` is one winning build,
 * which the tests replay; the hint follows whichever winning route best
 * matches what the child has built so far.
 */

export type Placed = CellRef & { type: PieceType; turns: number };

export type Level = {
  name: string;
  cols: number;
  rows: number;
  start: number;
  cup: CellRef;
  fixed: Placed[];
  blocked: CellRef[];
  open: CellRef[];
  tray: PieceType[];
  solution: Placed[];
};

/**
 * Turns, for reading the levels below:
 *   straight: 0 = left–right, 1 = top–bottom
 *   curve: 0 = left–bottom, 1 = bottom–right, 2 = right–top, 3 = top–left
 *   loop: 0 = left–right
 */
const straight = (col: number, row: number, turns: number): Placed => ({ col, row, type: "straight", turns });
const curve = (col: number, row: number, turns: number): Placed => ({ col, row, type: "curve", turns });
const loop = (col: number, row: number): Placed => ({ col, row, type: "loop", turns: 0 });
const cells = (...pairs: [number, number][]): CellRef[] => pairs.map(([col, row]) => ({ col, row }));
const pieces = (counts: Partial<Record<PieceType, number>>): PieceType[] =>
  (Object.entries(counts) as [PieceType, number][]).flatMap(([type, n]) => Array<PieceType>(n).fill(type));

/** A level where every cell that isn't fixed, blocked or the bucket is the child's to build on. */
export function level(def: Omit<Level, "open">): Level {
  const taken = new Set([...def.fixed, ...def.blocked, def.cup].map((c) => `${c.col},${c.row}`));
  const open: CellRef[] = [];
  for (let row = 0; row < def.rows; row++) {
    for (let col = 0; col < def.cols; col++) if (!taken.has(`${col},${row}`)) open.push({ col, row });
  }
  return { ...def, open };
}

/*
 * Designed with a generator (a random downhill route, a tray of just its
 * pieces plus spares, then blocks where the alternatives ran) and chosen by
 * eye. Each sketch below shows the winning route; levels.test.ts proves it
 * and counts the other paths.
 */
export const LEVELS: Level[] = [
  //   v
  // | └─────┐  .  . |
  // | . ### └─────┐ |
  // | .  .  .  . \_/|
  level({
    name: "Warm up",
    cols: 5,
    rows: 3,
    start: 0,
    cup: { col: 4, row: 2 },
    fixed: [],
    blocked: cells([1, 1]),
    tray: pieces({ curve: 5, straight: 2 }),
    solution: [curve(0, 0, 2), straight(1, 0, 0), curve(2, 0, 0), curve(2, 1, 2), straight(3, 1, 0), curve(4, 1, 0)],
  }),
  //            v
  // | .  . ### └──┐ |
  // | .  .  . ### │ |
  // |\_/──────────┘ |
  level({
    name: "The long way round",
    cols: 5,
    rows: 3,
    start: 3,
    cup: { col: 0, row: 2 },
    fixed: [],
    blocked: cells([2, 0], [3, 1]),
    tray: pieces({ curve: 4, straight: 4 }),
    solution: [curve(3, 0, 2), curve(4, 0, 0), straight(4, 1, 1), curve(4, 2, 3), straight(3, 2, 0), straight(2, 2, 0), straight(1, 2, 0)],
  }),
  //   v
  // | │ ### .  .  .  . |
  // | └────────┐  .  . |
  // |###### ┌──┘  .  . |
  // |\_/────┘ ### .  . |
  level({
    name: "Out and back",
    cols: 6,
    rows: 4,
    start: 0,
    cup: { col: 0, row: 3 },
    fixed: [],
    blocked: cells([1, 0], [0, 2], [1, 2], [3, 3]),
    tray: pieces({ curve: 5, straight: 5 }),
    solution: [
      straight(0, 0, 1),
      curve(0, 1, 2),
      straight(1, 1, 0),
      straight(2, 1, 0),
      curve(3, 1, 0),
      curve(3, 2, 3),
      curve(2, 2, 1),
      curve(2, 3, 3),
      straight(1, 3, 0),
    ],
  }),
  //         v
  // | .  .  └──O──┐  . |
  // | . ### . ### └──┐ |
  // |### . ###### ┌──┘ |
  // |\_/──────────┘  . |
  level({
    name: "Loop the loop",
    cols: 6,
    rows: 4,
    start: 2,
    cup: { col: 0, row: 3 },
    fixed: [],
    blocked: cells([1, 1], [3, 1], [0, 2], [2, 2], [3, 2]),
    tray: pieces({ curve: 9, straight: 3, loop: 1 }),
    solution: [
      curve(2, 0, 2),
      loop(3, 0),
      curve(4, 0, 0),
      curve(4, 1, 2),
      curve(5, 1, 0),
      curve(5, 2, 3),
      curve(4, 2, 1),
      curve(4, 3, 3),
      straight(3, 3, 0),
      straight(2, 3, 0),
      straight(1, 3, 0),
    ],
  }),
  //         v
  // | .  .  └────────┐  . |
  // |### .  . ###### └──┐ |
  // | . ###### . ### ┌──┘ |
  // |\_/───────O─────┘  . |
  level({
    name: "The big run",
    cols: 7,
    rows: 4,
    start: 2,
    cup: { col: 0, row: 3 },
    fixed: [],
    blocked: cells([0, 1], [3, 1], [4, 1], [1, 2], [2, 2], [4, 2]),
    tray: pieces({ curve: 8, straight: 6, loop: 1 }),
    solution: [
      curve(2, 0, 2),
      straight(3, 0, 0),
      straight(4, 0, 0),
      curve(5, 0, 0),
      curve(5, 1, 2),
      curve(6, 1, 0),
      curve(6, 2, 3),
      curve(5, 2, 1),
      curve(5, 3, 3),
      straight(4, 3, 0),
      loop(3, 3),
      straight(2, 3, 0),
      straight(1, 3, 0),
    ],
  }),
];
