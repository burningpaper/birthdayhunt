import { describe, expect, it } from "vitest";
import { LEVELS, ZONE_SIZE } from "./levels";
import { PIECE_TYPES, pieceSegments, sameOrientation } from "./pieces";
import { createRun, moverX, simulateRun, stepRun } from "./world";

describe("the five levels", () => {
  it("get harder: more zones and more pieces, with a decoy and a moving bar at the end", () => {
    expect(LEVELS).toHaveLength(5);
    expect(LEVELS.map((l) => l.zones.length)).toEqual([1, 2, 3, 3, 4]);
    expect(LEVELS.map((l) => l.tray.length)).toEqual([2, 3, 4, 5, 6]);
    expect(LEVELS[4].tray.length).toBeGreaterThan(LEVELS[4].solution.length);
    expect(LEVELS[4].mover).toBeDefined();
  });

  for (const level of LEVELS) {
    it(`"${level.name}": the solution lands in the cup, and nothing placed misses`, () => {
      expect(simulateRun(level, level.solution)).toBe("cup");
      expect(simulateRun(level, [])).toBe("miss");
    });

    it(`"${level.name}": the solution only uses pieces from the tray, one per zone`, () => {
      const tray = [...level.tray];
      for (const p of level.solution) {
        const i = tray.indexOf(p.type);
        expect(i, `${p.type} is on the tray`).toBeGreaterThanOrEqual(0);
        tray.splice(i, 1);
      }
      expect(new Set(level.solution.map((p) => p.zone)).size).toBe(level.solution.length);
    });

    it(`"${level.name}": build zones sit inside the play area`, () => {
      for (const z of level.zones) {
        expect(z.x - ZONE_SIZE / 2).toBeGreaterThanOrEqual(0);
        expect(z.x + ZONE_SIZE / 2).toBeLessThanOrEqual(1000);
        expect(z.y - ZONE_SIZE / 2).toBeGreaterThanOrEqual(0);
      }
    });
  }

  it("is deterministic, moving bar included: the same build always ends the same way", () => {
    const run = () => {
      const world = createRun(LEVELS[4], LEVELS[4].solution);
      while (stepRun(world) === "running");
      return [world.tick, world.marble.position];
    };
    expect(run()).toEqual(run());
  });

  it("the moving bar is what makes the last level tricky: a funnel build that works without it fails with it", () => {
    const level = LEVELS[4];
    const funnelBuild = [...level.solution.slice(0, 2), { zone: 2, type: "funnel" as const, turns: 3 }, { zone: 3, type: "ramp" as const, turns: 0 }];
    expect(simulateRun(level, funnelBuild)).toBe("miss");
    expect(simulateRun({ ...level, mover: undefined }, funnelBuild)).toBe("cup");
  });

  it("slides the moving bar between its ends", () => {
    const m = LEVELS[4].mover!;
    for (let tick = 0; tick < 2000; tick += 13) {
      const x = moverX(LEVELS[4], tick)!;
      expect(x).toBeGreaterThanOrEqual(m.fromX);
      expect(x).toBeLessThanOrEqual(m.toX);
    }
    expect(moverX(LEVELS[0], 10)).toBeNull();
  });
});

describe("pieces", () => {
  it("turn in 45° steps about their centre", () => {
    // Four 45° turns is a half turn: the ramp's ends swap sides.
    const [a, b] = pieceSegments("ramp", { x: 100, y: 100 }, 4)[0];
    expect(a.x).toBeCloseTo(180);
    expect(b.x).toBeCloseTo(20);
    // Two turns is a quarter turn: it stands upright.
    const [c, d] = pieceSegments("ramp", { x: 100, y: 100 }, 2)[0];
    expect(c.x).toBeCloseTo(100);
    expect(Math.abs(c.y - d.y)).toBeCloseTo(160);
    const tilted = pieceSegments("ramp", { x: 0, y: 0 }, 1)[0];
    expect(tilted[1].y).toBeCloseTo(80 * Math.SQRT1_2);
  });

  it("knows which rotations look the same", () => {
    expect(sameOrientation("ramp", 0, 4)).toBe(true);
    expect(sameOrientation("ramp", 1, 3)).toBe(false);
    expect(sameOrientation("curve", 0, 4)).toBe(false);
    expect(sameOrientation("curve", 1, 9)).toBe(true);
    expect(sameOrientation("bouncer", 0, 3)).toBe(true);
  });

  it("has four kinds, and a bouncer is drawn as a circle rather than segments", () => {
    expect(PIECE_TYPES).toEqual(["ramp", "curve", "funnel", "bouncer"]);
    expect(pieceSegments("bouncer", { x: 0, y: 0 }, 0)).toEqual([]);
  });
});
