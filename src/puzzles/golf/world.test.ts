import Matter from "matter-js";
import { describe, expect, it } from "vitest";
import { HOLES, holesFor, type Point } from "./holes";
import { MAX_SPEED, createWorld, launchVelocity, platformX, predictPath, shoot, simulateShot, step, windmillPeriod } from "./world";

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
      const wait = h.windmill ? windmillPeriod(h.windmill) * 2 + release(h) : 45;
      const nudge = h.windmill ? 0.75 : 1.5;
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
});
