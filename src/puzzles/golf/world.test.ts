import Matter from "matter-js";
import { describe, expect, it } from "vitest";
import { HOLES, holesFor, type Point } from "./holes";
import { MAX_SPEED, createWorld, launchVelocity, platformX, predictPath, shoot, simulateShot, step } from "./world";

function playUntilEvent(world: ReturnType<typeof createWorld>, maxTicks = 900) {
  for (let i = 0; i < maxTicks; i++) {
    const event = step(world);
    if (event !== "none") return event;
  }
  return "none";
}

describe("the course", () => {
  it("has five holes, and plays the first N", () => {
    expect(HOLES).toHaveLength(5);
    expect(holesFor(3).map((h) => h.name)).toEqual(HOLES.slice(0, 3).map((h) => h.name));
    expect(holesFor(99)).toHaveLength(5);
    expect(holesFor(0)).toHaveLength(1);
  });

  for (const hole of HOLES) {
    it(`"${hole.name}" can be sunk from the tee (its stored shot)`, () => {
      expect(simulateShot(hole, hole.testShot)).toBe("sunk");
    });
  }

  it("is deterministic: the same shot always does the same thing", () => {
    const run = () => {
      const world = createWorld(HOLES[4]);
      shoot(world, HOLES[4].testShot);
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
    const world = createWorld(HOLES[2]);
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
    const hole = HOLES[3];
    const world = createWorld(hole);
    const water = hole.water![0];
    Matter.Body.setPosition(world.ball, { x: water.x + water.w / 2, y: water.y + 10 } as Point);
    world.inFlight = true;
    expect(step(world)).toBe("lost");
    expect(world.ball.position).toEqual(hole.tee);
  });

  it("slides the moving platform between its ends", () => {
    const p = HOLES[4].movingPlatform!;
    for (let tick = 0; tick < 1000; tick += 7) {
      const x = platformX({ hole: HOLES[4], tick })!;
      expect(x).toBeGreaterThanOrEqual(p.fromX);
      expect(x).toBeLessThanOrEqual(p.toX);
    }
    expect(platformX({ hole: HOLES[0], tick: 5 })).toBeNull();
  });
});
