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

/** A sample for the look prototype (Stage M1); the real five come in Stage M3. */
export const LOOK_SAMPLE: Level = {
  name: "Look sample",
  cols: 5,
  rows: 3,
  start: 0,
  cup: { col: 4, row: 2 },
  fixed: [
    { col: 0, row: 0, type: "curve", turns: 2 },
    { col: 1, row: 0, type: "straight", turns: 0 },
    { col: 3, row: 1, type: "straight", turns: 1 },
    { col: 3, row: 2, type: "curve", turns: 2 },
  ],
  open: [
    { col: 2, row: 0 },
    { col: 3, row: 0 },
    { col: 1, row: 2 },
  ],
  tray: ["curve", "straight", "loop"],
  solution: [
    { col: 2, row: 0, type: "loop", turns: 0 },
    { col: 3, row: 0, type: "curve", turns: 0 },
  ],
};
