import Matter from "matter-js";
import { describe, expect, it } from "vitest";
import { HOLES, WORLD, holesFor, type Point } from "./holes";
import { MAX_SPEED, RAIL, createWorld, holeCycle, launchVelocity, platformX, predictPath, shoot, simulateShot, step, windmillPeriod } from "./world";

const hole = (name: string) => HOLES.find((h) => h.name === name)!;
/** The middle of a hole's release window (0 for holes without a windmill). */
const release = (h: (typeof HOLES)[number]) => (h.testShot.phase ? Math.round((h.testShot.phase[0] + h.testShot.phase[1]) / 2) : 0);

function playUntilEvent(world: ReturnType<typeof createWorld>, maxTicks = 900) {
  for (let i = 0; i < maxTicks; i++) {
    const event = step(world);
    if (event !== "none") return event;
  }
  return "none";
}

describe("the course", () => {
  it("has twelve holes, and plays the first N", () => {
    expect(HOLES).toHaveLength(12);
    expect(holesFor(3).map((h) => h.name)).toEqual(HOLES.slice(0, 3).map((h) => h.name));
    expect(holesFor(99)).toHaveLength(12);
    expect(holesFor(0)).toHaveLength(1);
  });

  for (const h of HOLES) {
    it(`"${h.name}" can be sunk from the tee (its stored shot${h.testShot.phase ? ", released in its window" : ""})`, () => {
      expect(simulateShot(h, h.testShot, 900, release(h))).toBe("sunk");
    });
  }

  for (const h of HOLES) {
    it(`"${h.name}"'s stored shot still sinks a little off, and after the ball has settled on the tee`, () => {
      // Real play adds both: a finger lands a fraction off, and the ball sits a while before the shot.
      const wait = h.testShot.phase ? holeCycle(h) * 2 + release(h) : 45;
      // Skimming the trampoline or timing the moving parts is precise by design, so those allow a finer margin.
      const nudge = h.precise || h.windmill || h.movingPlatform || h.bouncePads ? 0.75 : 1.5;
      for (const dx of [-nudge, nudge]) for (const dy of [-nudge, nudge]) {
        expect(simulateShot(h, { x: h.testShot.x + dx, y: h.testShot.y + dy }, 900, wait)).toBe("sunk");
      }
    });
  }

  it("is deterministic: the same shot always does the same thing", () => {
    const run = () => {
      const world = createWorld(hole("The moving bridge"));
      shoot(world, hole("The moving bridge").testShot);
      playUntilEvent(world);
      return world.ball.position;
    };
    expect(run()).toEqual(run());
  });
});

describe("shots", () => {
  it("launches away from the pull, capped at a top speed", () => {
    const v = launchVelocity({ x: -50, y: 20 });
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeLessThan(0);
    const huge = launchVelocity({ x: -5000, y: 0 });
    expect(Math.hypot(huge.x, huge.y)).toBeCloseTo(MAX_SPEED);
  });

  it("ignores a second shot while the ball is still moving", () => {
    const world = createWorld(HOLES[0]);
    shoot(world, { x: -60, y: 40 });
    step(world);
    const before = { ...world.ball.velocity };
    shoot(world, { x: 100, y: 100 });
    expect(world.ball.velocity).toEqual(before);
  });

  it("draws the aiming dots along a falling arc", () => {
    const dots = predictPath({ x: 0, y: 0 }, { x: -80, y: 80 }, 30);
    expect(dots).toHaveLength(10);
    expect(dots[0].x).toBeGreaterThan(0);
    expect(dots[0].y).toBeLessThan(0);
    // Gravity bends it: the rise slows down.
    expect(dots[1].y - dots[0].y).toBeGreaterThan(dots[0].y);
  });
});

describe("mishaps", () => {
  it("a gentle tap comes to rest, and that's the new respawn spot", () => {
    const world = createWorld(HOLES[0]);
    shoot(world, { x: -30, y: 0 });
    expect(playUntilEvent(world)).toBe("stopped");
    expect(world.restSpot.x).toBeGreaterThan(HOLES[0].tee.x);
  });

  it("falling into the gap puts the ball back where it last rested", () => {
    const world = createWorld(hole("Mind the gap"));
    shoot(world, { x: -40, y: 20 }); // far too weak to clear the gap
    let event = "none";
    for (let i = 0; i < 900 && event !== "lost"; i++) {
      event = step(world);
      if (event === "stopped") shoot(world, { x: -40, y: 20 });
    }
    expect(event).toBe("lost");
    expect(world.ball.position.y).toBeLessThan(460);
    expect(Math.hypot(world.ball.velocity.x, world.ball.velocity.y)).toBe(0);
  });

  it("landing in the water puts the ball back too", () => {
    const splash = hole("Splash and bounce");
    const world = createWorld(splash);
    const water = splash.water![0];
    Matter.Body.setPosition(world.ball, { x: water.x + water.w / 2, y: water.y + 10 } as Point);
    world.inFlight = true;
    expect(step(world)).toBe("lost");
    expect(world.ball.position).toEqual(splash.tee);
  });

  it("slides the moving platform between its ends", () => {
    const bridge = hole("The moving bridge");
    const p = bridge.movingPlatform!;
    for (let tick = 0; tick < 1000; tick += 7) {
      const x = platformX({ hole: bridge, tick })!;
      expect(x).toBeGreaterThanOrEqual(p.fromX);
      expect(x).toBeLessThanOrEqual(p.toX);
    }
    expect(platformX({ hole: HOLES[0], tick: 5 })).toBeNull();
  });
});

describe("obstacles", () => {
  it("the windmill lets a shot through only when it's released at the right moment", () => {
    const mill = hole("The windmill");
    const period = windmillPeriod(mill.windmill!);
    const outcomes = Array.from({ length: period }, (_, wait) => simulateShot(mill, mill.testShot, 900, wait));
    expect(outcomes.filter((o) => o === "sunk").length).toBeGreaterThan(0);
    expect(outcomes.filter((o) => o !== "sunk").length).toBeGreaterThan(period / 3); // mistimed, the blades bat it back
  });

  it("wind pushes a ball that's inside it", () => {
    const windy = hole("Headwind");
    const world = createWorld(windy);
    Matter.Body.setPosition(world.ball, { x: 500, y: 200 });
    Matter.Body.setVelocity(world.ball, { x: 5, y: 0 });
    world.inFlight = true;
    for (let i = 0; i < 10; i++) step(world);
    expect(world.ball.velocity.x).toBeLessThan(5 - 10 * 0.1); // slowed by more than the air alone would
  });

  it("sand grabs a rolling ball, far more than grass does", () => {
    const trap = hole("Sand trap");
    const roll = (x: number, y: number) => {
      const world = createWorld(trap);
      Matter.Body.setPosition(world.ball, { x, y });
      Matter.Body.setVelocity(world.ball, { x: 6, y: 0 });
      world.inFlight = true;
      for (let i = 0; i < 12; i++) step(world);
      return world.ball.position.x - x;
    };
    expect(roll(560, 462 - 11)).toBeLessThan(roll(200, 440 - 11) / 2);
  });

  it("a wall stops a low shot dead in its tracks", () => {
    const wall = hole("The wall");
    const world = createWorld(wall);
    shoot(world, { x: -160, y: 0 }); // flat and hard, straight at the wall
    for (let i = 0; i < 300; i++) step(world);
    expect(world.ball.position.x).toBeLessThan(wall.walls![0].x);
  });

  it("a proper shot from a ball resting in the sand blasts it out", () => {
    const trap = hole("Sand trap");
    const world = createWorld(trap);
    Matter.Body.setPosition(world.ball, { x: 640, y: 462 - 11 });
    for (let i = 0; i < 60; i++) step(world); // settle into the sand
    shoot(world, { x: -110, y: 110 });
    for (let i = 0; i < 40; i++) step(world);
    expect(world.ball.position.x).toBeGreaterThan(trap.sand![0].x + trap.sand![0].w); // out of the far side
  });

  it("keeps the ball on the screen: a hard shot at the edge drops beside the rail", () => {
    for (const pull of [{ x: 160, y: 20 }, { x: -160, y: 0 }]) {
      const world = createWorld(hole("Over the hill"));
      shoot(world, pull);
      let lost = false;
      for (let i = 0; i < 700; i++) if (step(world) === "lost") lost = true;
      expect(lost).toBe(false);
      expect(world.ball.position.x).toBeGreaterThan(RAIL);
      expect(world.ball.position.x).toBeLessThan(WORLD.width - RAIL);
    }
  });

  it("lets a ball resting against a rail be hit away from it", () => {
    const world = createWorld(hole("The warm-up"));
    Matter.Body.setPosition(world.ball, { x: WORLD.width - RAIL - 12, y: 440 - 11 }); // up against the right rail
    for (let i = 0; i < 30; i++) step(world);
    const against = world.ball.position.x;
    shoot(world, { x: 60, y: 0 }); // back to the left
    for (let i = 0; i < 60; i++) step(world);
    expect(world.ball.position.x).toBeLessThan(against - 50);
  });
});

/** Play a shot and note what the ball touched on the way: the obstacle a hole is built around. */
function playNoting(h: (typeof HOLES)[number], pull: Point, wait: number) {
  const world = createWorld(h);
  const touched = { pad: false, platform: false, wind: false, window: false };
  Matter.Events.on(world.engine, "collisionStart", (e) => {
    for (const pair of e.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (!labels.includes("ball")) continue;
      if (labels.includes("pad")) touched.pad = true;
      if (labels.includes("platform")) touched.platform = true;
    }
  });
  for (let i = 0; i < wait; i++) step(world);
  shoot(world, pull);
  let event = "none";
  for (let i = 0; i < 900 && event === "none"; i++) {
    event = step(world);
    const { x, y } = world.ball.position;
    if ((h.wind ?? []).some((z) => x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h)) touched.wind = true;
    // The letterbox: through the gap between the curtain above and the column below.
    const [curtain, column] = h.walls ?? [];
    if (h.name === "The letterbox" && x > curtain.x && x < curtain.x + curtain.w && y > curtain.y + curtain.h && y < column.y) touched.window = true;
  }
  return { sunk: event === "sunk", touched };
}

describe("obstacles can't be dodged", () => {
  // Every shot that sinks (from a grid of pull-backs, and across the hole's cycle) must have dealt with the obstacle.
  const cases = [
    { name: "Splash and bounce", needs: "pad" },
    { name: "The moving bridge", needs: "platform" },
    { name: "Headwind", needs: "wind" },
    { name: "The grand finale", needs: "wind" },
    { name: "The letterbox", needs: "window" },
  ] as const;
  for (const { name, needs } of cases) {
    it(`"${name}": every sinking shot uses the ${needs}`, () => {
      const h = hole(name);
      const cycle = holeCycle(h);
      const waits = cycle > 1 ? Array.from({ length: 8 }, (_, i) => Math.round((i * cycle) / 8)) : [0];
      let sunk = 0;
      for (let x = -162; x <= 0; x += 9) for (let y = 0; y <= 162; y += 9) for (const wait of waits) {
        const shot = playNoting(h, { x, y }, wait);
        if (!shot.sunk) continue;
        sunk++;
        expect(shot.touched[needs], `pull ${x},${y} after ${wait} ticks sank without the ${needs}`).toBe(true);
      }
      expect(sunk, "the grid should find some sinking shots, or this test proves nothing").toBeGreaterThan(0);
    });
  }

  it("a ball resting on the moving bridge can be hit from there, but a lost ball never respawns on it", () => {
    const bridge = hole("The moving bridge");
    const world = createWorld(bridge);
    Matter.Body.setPosition(world.ball, { x: platformX(world)! + 60, y: bridge.movingPlatform!.y - 11 });
    world.inFlight = true;
    let event = "none";
    for (let i = 0; i < 200 && event !== "stopped"; i++) event = step(world);
    expect(event).toBe("stopped"); // resting on the bridge: ready for a shot
    expect(world.restSpot).toEqual(bridge.tee); // but a lost ball still goes back to the tee
  });
});
