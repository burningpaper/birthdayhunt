import { describe, expect, it } from "vitest";
import { simulate } from "./engine";
import { LEVELS, type Level, type Placed } from "./levels";
import { TURNS, type PieceType } from "./track";

/** Every way to put some of the tray's pieces into the open cells, turned every way. */
function everyBuild(level: Level): Placed[][] {
  const builds: Placed[][] = [];
  const place = (i: number, left: PieceType[], built: Placed[]) => {
    if (i === level.open.length) return void builds.push(built);
    place(i + 1, left, built);
    [...new Set(left)].forEach((type) => {
      const rest = [...left];
      rest.splice(rest.indexOf(type), 1);
      for (let turns = 0; turns < TURNS[type]; turns++) place(i + 1, rest, [...built, { ...level.open[i], type, turns }]);
    });
  };
  place(0, level.tray, []);
  return builds;
}

const cellKey = (c: { col: number; row: number }) => `${c.col},${c.row}`;

describe.each(LEVELS.map((level, i) => [i + 1, level] as const))("level %i", (_, level) => {
  it("fits its board, with no two things in one cell", () => {
    const cells = [...level.fixed, ...level.open, level.cup];
    for (const c of cells) {
      expect(c.col).toBeGreaterThanOrEqual(0);
      expect(c.col).toBeLessThan(level.cols);
      expect(c.row).toBeGreaterThanOrEqual(0);
      expect(c.row).toBeLessThan(level.rows);
    }
    expect(new Set(cells.map(cellKey)).size).toBe(cells.length);
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

  it("is rarely solved by chance: at most 2 builds in every possible one land in the cup", () => {
    const wins = everyBuild(level).filter((b) => simulate(level, b).result === "cup");
    expect(wins.length).toBeGreaterThanOrEqual(1);
    expect(wins.length).toBeLessThanOrEqual(2);
  });
});
