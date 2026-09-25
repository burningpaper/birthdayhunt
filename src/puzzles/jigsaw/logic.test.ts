import { describe, expect, it } from "vitest";
import {
  SNAP_DISTANCE,
  computeLayout,
  gridFor,
  homeOf,
  isOverBoard,
  makeTabs,
  pieceSides,
  piecePath,
  scatter,
  seededRng,
  shouldSnap,
  shuffle,
} from "./logic";

describe("gridFor", () => {
  it("lays pieces out wide for landscape photos and tall for portrait", () => {
    expect(gridFor(12, 4 / 3)).toEqual({ cols: 4, rows: 3 });
    expect(gridFor(12, 3 / 4)).toEqual({ cols: 3, rows: 4 });
    expect(gridFor(6, 1.5)).toEqual({ cols: 3, rows: 2 });
    expect(gridFor(16, 1)).toEqual({ cols: 4, rows: 4 });
  });

  it("always yields the requested number of pieces", () => {
    for (const pieces of [6, 9, 12, 16] as const) {
      const { cols, rows } = gridFor(pieces, 1.33);
      expect(cols * rows).toBe(pieces);
    }
  });
});

describe("tabs", () => {
  const rng = seededRng(42);
  const cols = 4;
  const rows = 3;
  const tabs = makeTabs(cols, rows, rng);

  it("gives border edges no tabs", () => {
    for (let c = 0; c < cols; c++) {
      expect(pieceSides(c, 0, tabs).top).toBe(0);
      expect(pieceSides(c, rows - 1, tabs).bottom).toBe(0);
    }
    for (let r = 0; r < rows; r++) {
      expect(pieceSides(0, r, tabs).left).toBe(0);
      expect(pieceSides(cols - 1, r, tabs).right).toBe(0);
    }
  });

  it("makes every shared edge a tab on one side and a hole on the other", () => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const here = pieceSides(c, r, tabs);
        if (c < cols - 1) {
          expect(here.right).toBe(-pieceSides(c + 1, r, tabs).left);
          expect(Math.abs(here.right)).toBe(1);
        }
        if (r < rows - 1) {
          expect(here.bottom).toBe(-pieceSides(c, r + 1, tabs).top);
          expect(Math.abs(here.bottom)).toBe(1);
        }
      }
    }
  });
});

describe("piecePath", () => {
  it("draws a plain rectangle for a piece with no tabs", () => {
    expect(piecePath(100, 80, { top: 0, right: 0, bottom: 0, left: 0 }, 20)).toBe("M0,0 L100,0 L100,80 L0,80 L0,0 Z");
  });

  it("adds four curves per tab and reaches outside the cell for a tab", () => {
    const path = piecePath(100, 80, { top: 0, right: 1, bottom: -1, left: 0 }, 20);
    expect(path.match(/C/g)).toHaveLength(8);
    const xs = [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[1]));
    const ys = [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[2]));
    expect(Math.max(...xs)).toBeCloseTo(120); // the right tab sticks out by the full depth
    expect(Math.max(...ys)).toBeLessThanOrEqual(80); // the bottom hole stays inside
    expect(path.startsWith("M0,0")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
  });
});

describe("layout and scatter", () => {
  const layout = computeLayout(1194, 700, 4 / 3, 4, 4);

  it("centres a board that fits the play area", () => {
    const { board } = layout;
    expect(board.x).toBeGreaterThan(0);
    expect(board.x + board.w).toBeLessThan(1194);
    expect(board.y + board.h).toBeLessThanOrEqual(700);
    expect(board.w / board.h).toBeCloseTo(4 / 3);
  });

  it("puts every loose piece inside the play area", () => {
    const spots = scatter(layout, 16, seededRng(7));
    expect(spots).toHaveLength(16);
    for (const spot of spots) {
      expect(spot.x - layout.depth).toBeGreaterThanOrEqual(0);
      expect(spot.y - layout.depth).toBeGreaterThanOrEqual(0);
      expect(spot.x + layout.cellW + layout.depth).toBeLessThanOrEqual(1194 + 0.01);
      expect(spot.y + layout.cellH + layout.depth).toBeLessThanOrEqual(700 + 0.01);
    }
  });

  it("keeps loose pieces clear of the board and of each other, for every size", () => {
    for (const pieces of [6, 9, 12, 16] as const) {
      for (const aspect of [4 / 3, 1, 3 / 4, 16 / 9]) {
        const { cols, rows } = gridFor(pieces, aspect);
        const l = computeLayout(1194, 738, aspect, cols, rows);
        const boxW = l.cellW + 2 * l.depth;
        const boxH = l.cellH + 2 * l.depth;
        const spots = scatter(l, pieces, seededRng(pieces));
        for (const [i, a] of spots.entries()) {
          // Not on the board.
          const overBoard = a.x - l.depth + boxW > l.board.x + 1 && a.x - l.depth < l.board.x + l.board.w - 1;
          expect(overBoard, `${pieces} pieces, aspect ${aspect.toFixed(2)}: piece ${i} overlaps the board`).toBe(false);
          // Never more than a quarter hidden by one neighbour (plus the jitter).
          for (const b of spots.slice(i + 1)) {
            const overlapW = Math.max(0, Math.min(a.x, b.x) + boxW - Math.max(a.x, b.x));
            const overlapH = Math.max(0, Math.min(a.y, b.y) + boxH - Math.max(a.y, b.y));
            expect((overlapW * overlapH) / (boxW * boxH), `${pieces} pieces, aspect ${aspect.toFixed(2)}, cols/side ${JSON.stringify([l.board.x, boxW, boxH])}`).toBeLessThanOrEqual(0.3);
          }
        }
      }
    }
  });

  it("is deterministic for a seed", () => {
    expect(scatter(layout, 9, seededRng(3))).toEqual(scatter(layout, 9, seededRng(3)));
  });
});

describe("snapping", () => {
  const layout = computeLayout(1194, 700, 4 / 3, 3, 3);
  const home = homeOf(layout, 1, 2);

  it("snaps within about 30px when the right way up", () => {
    expect(shouldSnap({ x: home.x + 20, y: home.y - 15 }, home, 0)).toBe(true);
    expect(shouldSnap({ x: home.x + SNAP_DISTANCE + 1, y: home.y }, home, 0)).toBe(false);
  });

  it("refuses to snap a rotated piece", () => {
    expect(shouldSnap(home, home, 1)).toBe(false);
    expect(shouldSnap(home, home, 4)).toBe(true);
  });

  it("knows when a drop landed on the board", () => {
    expect(isOverBoard(home, layout)).toBe(true);
    expect(isOverBoard({ x: 0, y: 0 }, layout)).toBe(false);
  });
});

describe("shuffle", () => {
  it("keeps every item", () => {
    expect(shuffle([1, 2, 3, 4, 5], seededRng(1)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
