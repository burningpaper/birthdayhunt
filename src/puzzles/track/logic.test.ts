import { describe, expect, it } from "vitest";
import { seededRng } from "../random";
import { E, N, S, W, applySolution, connections, exitSide, findSolution, generate, rotateMask, routeNeeds, trace, turnsFor, type Board } from "./logic";

describe("tiles", () => {
  it("rotates masks clockwise", () => {
    expect(rotateMask(N, 1)).toBe(E);
    expect(rotateMask(N | E, 1)).toBe(E | S);
    expect(rotateMask(W, 1)).toBe(N);
    expect(rotateMask(N | S, 2)).toBe(N | S);
    expect(rotateMask(N | E, 5)).toBe(E | S);
  });

  it("carries the train through a straight, a curve and a cross", () => {
    expect(exitSide({ kind: "straight", turns: 1 }, W)).toBe(E);
    expect(exitSide({ kind: "curve", turns: 0 }, N)).toBe(E);
    expect(exitSide({ kind: "cross", turns: 0 }, W)).toBe(E);
    expect(exitSide({ kind: "cross", turns: 3 }, N)).toBe(S);
    expect(exitSide({ kind: "straight", turns: 0 }, W)).toBeNull();
  });

  it("finds the rotation for a needed connection", () => {
    expect(connections({ kind: "curve", turns: turnsFor("curve", S | W)! })).toBe(S | W);
    expect(turnsFor("straight", N | E)).toBeNull();
    expect(turnsFor("cross", W | E)).toBe(0);
  });
});

describe("trace", () => {
  it("solves a straight run across one row", () => {
    const board: Board = { size: 2, startRow: 0, endRow: 0, tiles: [[{ kind: "straight", turns: 1 }, { kind: "straight", turns: 1 }], [{ kind: "curve", turns: 0 }, { kind: "curve", turns: 0 }]] };
    const result = trace(board);
    expect(result.solved).toBe(true);
    expect(result.cells.map((c) => [c.x, c.y])).toEqual([[0, 0], [1, 0]]);
  });

  it("stops where the track breaks", () => {
    const board: Board = { size: 2, startRow: 0, endRow: 0, tiles: [[{ kind: "straight", turns: 1 }, { kind: "straight", turns: 0 }], [{ kind: "curve", turns: 0 }, { kind: "curve", turns: 0 }]] };
    const result = trace(board);
    expect(result.solved).toBe(false);
    expect(result.cells).toHaveLength(1);
  });

  it("doesn't count leaving by the wrong edge or row", () => {
    const board: Board = { size: 2, startRow: 0, endRow: 1, tiles: [[{ kind: "straight", turns: 1 }, { kind: "straight", turns: 1 }], [{ kind: "curve", turns: 0 }, { kind: "curve", turns: 0 }]] };
    expect(trace(board).solved).toBe(false);
  });
});

describe("generate", () => {
  for (const size of [4, 5, 6]) {
    it(`always makes solvable, unsolved ${size}×${size} puzzles`, () => {
      for (let seed = 1; seed <= 60; seed++) {
        const { board, route } = generate(size, seededRng(seed * 7919 + size));
        expect(trace(board).solved, `seed ${seed} starts solved`).toBe(false);
        expect(route.length).toBeGreaterThanOrEqual(size);

        // The planted route works...
        expect(trace(applySolution(board, routeNeeds(route))).solved, `seed ${seed} route`).toBe(true);
        // ...and the independent solver finds a way too.
        const kinds = board.tiles.map((row) => row.map((t) => t.kind));
        const needs = findSolution(kinds, board.startRow, board.endRow);
        expect(needs, `seed ${seed} unsolvable`).not.toBeNull();
        expect(trace(applySolution(board, needs!)).solved).toBe(true);
      }
    });
  }

  it("winds rather than dashing straight across", () => {
    const lengths = Array.from({ length: 30 }, (_, i) => generate(5, seededRng(i + 1)).route.length);
    const average = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    expect(average).toBeGreaterThanOrEqual(7);
  });
});
