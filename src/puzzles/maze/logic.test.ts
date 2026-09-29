import { describe, expect, it } from "vitest";
import { SHAPE, drawTo, makeMaze, passable, route, same, type Cell } from "./logic";

const count = (grid: boolean[][]) => grid.flat().filter(Boolean).length;

describe("the cat maze", () => {
  for (const cols of [15, 19, 25]) {
    it(`at ${cols} across: a perfect maze over the whole cat, mouth to tummy`, () => {
      const maze = makeMaze(cols, 1234);
      const cells = count(maze.inside);
      expect(cells).toBeGreaterThan(cols * 5);
      expect(maze.inside[maze.mouth.r][maze.mouth.c]).toBe(true);
      expect(maze.inside[maze.tummy.r][maze.tummy.c]).toBe(true);
      // It fills the whole cat, head included.
      const inHead = maze.inside.flatMap((row, r) => row.filter((ok, c) => ok && Math.hypot((c + 0.5) * maze.scale - SHAPE.head.x, (r + 0.5) * maze.scale - SHAPE.head.y) < SHAPE.head.r));
      expect(inHead.length, "head cells").toBeGreaterThan(10);
      // The way in is the mouth, at the cat's left edge: nothing to its left, the leftmost cell of its row.
      expect(maze.inside[maze.mouth.r][maze.mouth.c - 1]).toBeFalsy();
      expect(maze.inside[maze.mouth.r].findIndex(Boolean)).toBe(maze.mouth.c);
      expect(maze.mouth.c).toBeLessThan(maze.cols / 5);
      // The tummy is well to its right, in the body.
      expect(maze.tummy.c).toBeGreaterThan(maze.cols / 2 - 2);

      // Perfect: every cell reachable from the tummy, and exactly cells - 1 passages (a tree, no loops).
      let passages = 0;
      maze.inside.forEach((row, r) =>
        row.forEach((ok, c) => {
          if (!ok) return;
          expect(route(maze, { c, r }, maze.tummy).length, `cell ${c},${r} unreachable`).toBeGreaterThan(0);
          if (maze.open[r][c].E) passages++;
          if (maze.open[r][c].S) passages++;
        }),
      );
      expect(passages).toBe(cells - 1);

      // The route is real and satisfyingly long.
      const { solution } = maze;
      expect(same(solution[0], maze.mouth)).toBe(true);
      expect(same(solution[solution.length - 1], maze.tummy)).toBe(true);
      for (let i = 1; i < solution.length; i++) expect(passable(maze, solution[i - 1], solution[i])).toBe(true);
      expect(solution.length).toBeGreaterThanOrEqual(Math.floor(cells / 4));
    });
  }

  it("is the same maze for the same seed, and a different one for another", () => {
    const a = makeMaze(19, 42);
    expect(makeMaze(19, 42).open).toEqual(a.open);
    expect(makeMaze(19, 43).open).not.toEqual(a.open);
  });
});

describe("drawing through it", () => {
  const maze = makeMaze(19, 7);
  const { solution } = maze;

  it("follows the corridors, filling in a few skipped cells on a quick swipe", () => {
    let path: Cell[] = [maze.mouth];
    path = drawTo(maze, path, solution[1]);
    expect(path).toEqual(solution.slice(0, 2));
    path = drawTo(maze, path, solution[4]); // skipped two
    expect(path).toEqual(solution.slice(0, 5));
  });

  it("won't go through a wall, or leap too far", () => {
    const path = [maze.mouth];
    expect(drawTo(maze, path, solution[10])).toEqual(path); // too far in one go
    // A neighbour across a wall, whose way round is longer than a swipe fills in: not reachable.
    let tested = 0;
    maze.inside.forEach((row, r) =>
      row.forEach((ok, c) => {
        if (!ok) return;
        const here = { c, r };
        for (const n of [{ c: c + 1, r }, { c, r: r + 1 }]) {
          if (!maze.inside[n.r]?.[n.c] || passable(maze, here, n) || route(maze, here, n).length - 1 <= 4) continue;
          expect(drawTo(maze, [here], n)).toEqual([here]);
          tested++;
        }
      }),
    );
    expect(tested).toBeGreaterThan(10);
  });

  it("rubs out by going back over the line", () => {
    const path = solution.slice(0, 6);
    expect(drawTo(maze, path, solution[2])).toEqual(solution.slice(0, 3));
  });

  it("ignores anything outside the cat", () => {
    const path = [maze.mouth];
    expect(drawTo(maze, path, { c: 0, r: 0 })).toEqual(path);
  });
});
