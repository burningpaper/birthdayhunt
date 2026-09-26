import type { CellRef, PieceType } from "./track";

/**
 * Marble run levels, as data. The marble drops from a tube above the top
 * row at column `start`, straight down into that cell. `fixed` pieces are
 * screwed to the board; `open` cells are where the child builds; `tray`
 * lists the pieces on offer; `solution` is the intended build, which tests
 * replay to prove the level works and the hint shows a piece of.
 */

export type Placed = CellRef & { type: PieceType; turns: number };

export type Level = {
  name: string;
  cols: number;
  rows: number;
  start: number;
  cup: CellRef;
  fixed: Placed[];
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

export const LEVELS: Level[] = [
  {
    name: "One gap",
    cols: 5,
    rows: 3,
    start: 0,
    cup: { col: 4, row: 2 },
    fixed: [curve(0, 0, 2), straight(1, 0, 0), curve(3, 0, 0), straight(3, 1, 1), curve(3, 2, 2)],
    open: [{ col: 2, row: 0 }],
    tray: ["straight", "curve"],
    solution: [straight(2, 0, 0)],
  },
  {
    name: "Round the bend",
    cols: 5,
    rows: 3,
    start: 4,
    cup: { col: 0, row: 2 },
    fixed: [straight(4, 0, 1), straight(3, 1, 0), straight(2, 1, 0), curve(1, 2, 3)],
    open: [
      { col: 4, row: 1 },
      { col: 1, row: 1 },
    ],
    tray: ["curve", "straight", "curve"],
    solution: [curve(4, 1, 3), curve(1, 1, 1)],
  },
  {
    name: "Zig-zag",
    cols: 6,
    rows: 3,
    start: 0,
    cup: { col: 5, row: 2 },
    fixed: [curve(0, 0, 2), straight(1, 0, 0), curve(2, 0, 0), straight(1, 1, 0), curve(0, 2, 2), straight(1, 2, 0), straight(2, 2, 0), straight(3, 2, 0)],
    open: [
      { col: 2, row: 1 },
      { col: 0, row: 1 },
      { col: 4, row: 2 },
    ],
    tray: ["curve", "straight", "curve", "straight"],
    solution: [curve(2, 1, 3), curve(0, 1, 1), straight(4, 2, 0)],
  },
  {
    name: "Loop the loop",
    cols: 6,
    rows: 3,
    start: 5,
    cup: { col: 0, row: 2 },
    fixed: [curve(5, 0, 3), straight(4, 0, 0), curve(2, 0, 1), straight(2, 1, 1)],
    open: [
      { col: 3, row: 0 },
      { col: 2, row: 2 },
      { col: 1, row: 2 },
    ],
    tray: ["loop", "curve", "straight", "curve"],
    solution: [loop(3, 0), curve(2, 2, 3), straight(1, 2, 0)],
  },
  {
    name: "The big run",
    cols: 6,
    rows: 3,
    start: 1,
    cup: { col: 5, row: 2 },
    fixed: [straight(2, 0, 0), curve(4, 0, 0), straight(3, 1, 0), straight(2, 1, 0), curve(1, 2, 2), straight(2, 2, 0), straight(4, 2, 0)],
    open: [
      { col: 1, row: 0 },
      { col: 3, row: 0 },
      { col: 4, row: 1 },
      { col: 1, row: 1 },
      { col: 3, row: 2 },
    ],
    tray: ["curve", "loop", "curve", "straight", "curve", "curve"],
    solution: [curve(1, 0, 2), loop(3, 0), curve(4, 1, 3), curve(1, 1, 1), straight(3, 2, 0)],
  },
];
