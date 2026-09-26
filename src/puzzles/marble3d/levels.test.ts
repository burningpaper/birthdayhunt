import { describe, expect, it } from "vitest";
import { simulate } from "./engine";
import { LEVELS } from "./levels";
import { distinctPaths, hintPiece, winningRoutes } from "./routes";

const cellKey = (c: { col: number; row: number }) => `${c.col},${c.row}`;

describe.each(LEVELS.map((level, i) => [i + 1, level] as const))("level %i", (number, level) => {
  it("fits its board, with no two things in one cell", () => {
    const cells = [...level.fixed, ...level.blocked, ...level.open, level.cup];
    for (const c of cells) {
      expect(c.col).toBeGreaterThanOrEqual(0);
      expect(c.col).toBeLessThan(level.cols);
      expect(c.row).toBeGreaterThanOrEqual(0);
      expect(c.row).toBeLessThan(level.rows);
    }
    expect(new Set(cells.map(cellKey)).size).toBe(cells.length);
    expect(cells).toHaveLength(level.cols * level.rows);
  });

  it("is solved by its solution, using only open cells and tray pieces", () => {
    expect(simulate(level, level.solution).result).toBe("cup");
    const open = new Set(level.open.map(cellKey));
    expect(level.solution.every((p) => open.has(cellKey(p)))).toBe(true);
    const tray = [...level.tray];
    for (const p of level.solution) {
      expect(tray).toContain(p.type);
      tray.splice(tray.indexOf(p.type), 1);
    }
  });

  it("isn't solved by an empty board", () => {
    expect(simulate(level, []).result).toBe("miss");
  });

  it("takes planning: the tray allows only a couple of different paths to the bucket", () => {
    const routes = winningRoutes(level);
    expect(routes.length).toBeGreaterThanOrEqual(1);
    // The warm-up is allowed a little more freedom.
    expect(distinctPaths(routes)).toBeLessThanOrEqual(number === 1 ? 3 : 2);
  });
});

describe("the levels together", () => {
  it("get longer: each needs more pieces than the one before", () => {
    const sizes = LEVELS.map((l) => l.solution.length);
    sizes.slice(1).forEach((n, i) => expect(n).toBeGreaterThan(sizes[i]));
  });

  it("hint the next piece of the winning route closest to what's built", () => {
    const level = LEVELS[2];
    const routes = winningRoutes(level);
    expect(hintPiece(routes, [])).toEqual(routes[0][0]);
    // With the first three pieces of the solution in place, the hint is its fourth.
    const built = level.solution.slice(0, 3);
    const route = routes.find((r) => built.every((b) => r.some((p) => cellKey(p) === cellKey(b) && p.type === b.type && p.turns === b.turns)))!;
    expect(hintPiece(routes, built)).toEqual(route.find((p) => !built.some((b) => cellKey(b) === cellKey(p))));
  });
});
