import { describe, expect, it } from "vitest";
import { TABLE_Y, simulate } from "./engine";
import { LEVELS, type Level, type Placed } from "./levels";
import { MARBLE_RADIUS, cellCentre, portPoint, type CellRef } from "./track";

/** A bare 4 × 3 board, marble dropping into column 0, bucket bottom right. */
function board(fixed: Placed[], cup = { col: 3, row: 2 }, stars: CellRef[] = []): Level {
  return { name: "test", cols: 4, rows: 3, start: 0, cup, fixed, blocked: [], stars, open: [], tray: [], solution: [] };
}

/** Down column 0, along the bottom row to the bucket. */
const DOWN_AND_ALONG: Placed[] = [
  { col: 0, row: 0, type: "straight", turns: 1 },
  { col: 0, row: 1, type: "straight", turns: 1 },
  { col: 0, row: 2, type: "curve", turns: 2 },
  { col: 1, row: 2, type: "straight", turns: 0 },
  { col: 2, row: 2, type: "straight", turns: 0 },
];

describe("marble run engine", () => {
  it("rolls through pieces that join snugly and lands in the bucket", () => {
    const run = simulate(board(DOWN_AND_ALONG), []);
    expect(run.result).toBe("cup");
    expect(run.events.filter((e) => e.kind === "join")).toHaveLength(5);
    const end = run.frames[run.frames.length - 1];
    const bucket = cellCentre({ col: 3, row: 2 }, 3);
    expect(Math.abs(end.x - bucket.x)).toBeLessThan(0.3);
    expect(end.y).toBeLessThan(bucket.y - 0.2);
  });

  it("starts every run in the start tube, whatever happened last time", () => {
    const first = simulate(board(DOWN_AND_ALONG.slice(0, 2)), []);
    const again = simulate(board(DOWN_AND_ALONG.slice(0, 2)), []);
    expect(first.frames[0]).toEqual(again.frames[0]);
    expect(first.frames[0]).toMatchObject({ x: 0.5, y: 3.5 });
  });

  it("flies off at an opening with nothing on the other side, and ends up on the table", () => {
    const run = simulate(board(DOWN_AND_ALONG.slice(0, 3)), []); // the bottom row stops after the curve
    expect(run.result).toBe("miss");
    expect(run.reason).toBe("flew");
    const fly = run.events.find((e) => e.kind === "fly")!;
    const from = run.frames[fly.tick];
    const exit = portPoint({ col: 0, row: 2 }, "R", 3);
    expect(from.x).toBeCloseTo(exit.x, 1);
    expect(from.y).toBeCloseTo(exit.y, 1);
    const end = run.frames[run.frames.length - 1];
    expect(end.y).toBeCloseTo(TABLE_Y + MARBLE_RADIUS, 2);
    expect(end.z).toBeGreaterThan(0.5); // popped out towards the player
    expect(run.events.some((e) => e.kind === "bounce")).toBe(true);
  });

  it("flies off at a join that doesn't match, even with a piece there", () => {
    const wrongWay = DOWN_AND_ALONG.map((p) => (p.col === 1 && p.row === 2 ? { ...p, turns: 1 } : p)); // upright, not flat
    const run = simulate(board(wrongWay), []);
    expect(run.reason).toBe("flew");
  });

  it("rolls back down when it can't climb any higher, then comes to rest: a miss", () => {
    // Down column 0, along, and up column 1: the bends have cost it too much speed to climb out of the top.
    const uAndUp: Placed[] = [
      { col: 0, row: 0, type: "straight", turns: 1 },
      { col: 0, row: 1, type: "curve", turns: 2 },
      { col: 1, row: 1, type: "curve", turns: 3 },
      { col: 1, row: 0, type: "straight", turns: 1 },
    ];
    // (0,1) turns top→right; (1,1) turns left→top; so the marble heads back up column 1.
    const run = simulate(board(uAndUp), []);
    expect(run.result).toBe("miss");
    expect(run.reason).toBe("stuck");
    expect(run.events.filter((e) => e.kind === "back").length).toBeGreaterThan(1);
  });

  it("goes all the way round a loop", () => {
    const withLoop = DOWN_AND_ALONG.map((p) => (p.col === 1 && p.row === 2 ? { ...p, type: "loop" as const, turns: 0 } : p));
    const run = simulate(board(withLoop), []);
    expect(run.result).toBe("cup");
    const c = cellCentre({ col: 1, row: 2 }, 3);
    const inLoopCell = run.frames.filter((f) => Math.abs(f.x - c.x) < 0.5 && Math.abs(f.y - c.y) < 0.5);
    expect(Math.max(...inLoopCell.map((f) => f.y))).toBeGreaterThan(c.y + 0.15); // over the top of the loop
    expect(Math.min(...inLoopCell.map((f) => f.y))).toBeLessThan(c.y - 0.3); // and through its foot
  });

  it("is deterministic: the same build always does exactly the same thing", () => {
    const a = simulate(LEVELS[4], LEVELS[4].solution);
    const b = simulate(LEVELS[4], LEVELS[4].solution);
    expect(a).toEqual(b);
  });

  it("counts a piece the child placed exactly like a fixed one", () => {
    const [first, ...rest] = DOWN_AND_ALONG;
    expect(simulate(board(rest), [first]).result).toBe("cup");
    expect(simulate(board(rest), []).result).toBe("miss");
  });

  describe("stars", () => {
    it("collects each star once, as the marble rolls into its cell, and then the bucket counts", () => {
      const stars = [{ col: 0, row: 1 }, { col: 2, row: 2 }];
      const run = simulate(board(DOWN_AND_ALONG, undefined, stars), []);
      expect(run.result).toBe("cup");
      expect(run.events.filter((e) => e.kind === "star").map((e) => e.cell)).toEqual(stars);
    });

    it("doesn't count the bucket if the run skipped a star: the marble drops in, but it's a miss", () => {
      const run = simulate(board(DOWN_AND_ALONG, undefined, [{ col: 1, row: 1 }]), []); // nothing passes (1,1)
      expect(run.result).toBe("miss");
      expect(run.reason).toBe("stars");
      expect(run.events.some((e) => e.kind === "cup")).toBe(true);
    });
  });
});
