import Matter from "matter-js";
import { BALL_RADIUS, CUP, WORLD, type Hole, type Point } from "./holes";

/**
 * One hole's physics, with no drawing, so the same code runs in the browser
 * and in tests. The world steps at a fixed 60 ticks a second, which keeps it
 * deterministic: the same shot at the same tick always does the same thing.
 */

export const TICK_MS = 1000 / 60;
/** Launch speed per unit of pull-back, and the cap (units per tick). */
export const POWER = 0.11;
export const MAX_SPEED = 18;
const GROUND_THICKNESS = 40;
const REST_SPEED = 0.12;
const REST_TICKS = 20;

export type GolfEvent = "none" | "sunk" | "lost" | "stopped";

export type GolfWorld = {
  hole: Hole;
  engine: Matter.Engine;
  ball: Matter.Body;
  platform?: Matter.Body;
  tick: number;
  /** Where the ball goes back to if it's lost: the last place it came to rest. */
  restSpot: Point;
  stillTicks: number;
  inFlight: boolean;
  sunk: boolean;
};

/** A static slab lying along one ground segment, solid on its lower side. */
function segmentBody(a: Point, b: Point): Matter.Body {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  // Normal pointing into the ground (the segment's right-hand side, y down).
  const nx = -dy / length;
  const ny = dx / length;
  return Matter.Bodies.rectangle(
    (a.x + b.x) / 2 + (nx * GROUND_THICKNESS) / 2,
    (a.y + b.y) / 2 + (ny * GROUND_THICKNESS) / 2,
    length + 2, // a hair of overlap so the ball never catches on a seam
    GROUND_THICKNESS,
    { isStatic: true, angle, friction: 0.9, restitution: 0.3, label: "ground" },
  );
}

export function platformX(world: Pick<GolfWorld, "hole" | "tick">): number | null {
  const p = world.hole.movingPlatform;
  if (!p) return null;
  const span = p.toX - p.fromX;
  const travelled = (world.tick * p.speed) % (span * 2);
  return p.fromX + (travelled <= span ? travelled : span * 2 - travelled);
}

export function createWorld(hole: Hole): GolfWorld {
  const engine = Matter.Engine.create({ positionIterations: 10, velocityIterations: 8 });
  const bodies: Matter.Body[] = [];

  for (const island of hole.islands) {
    for (let i = 0; i < island.length - 1; i++) bodies.push(segmentBody(island[i], island[i + 1]));
  }
  for (const pad of hole.bouncePads ?? []) {
    bodies.push(Matter.Bodies.rectangle(pad.x + pad.w / 2, pad.y - 6, pad.w, 12, { isStatic: true, restitution: 1.25, friction: 0.2, label: "pad" }));
  }

  let platform: Matter.Body | undefined;
  if (hole.movingPlatform) {
    const p = hole.movingPlatform;
    platform = Matter.Bodies.rectangle(p.fromX + p.w / 2, p.y + 8, p.w, 16, { isStatic: true, friction: 1, restitution: 0.2, label: "platform" });
    bodies.push(platform);
  }

  const ball = Matter.Bodies.circle(hole.tee.x, hole.tee.y, BALL_RADIUS, {
    restitution: 0.45,
    friction: 0.03,
    frictionStatic: 0.2,
    frictionAir: 0.004,
    density: 0.002,
    label: "ball",
  });
  bodies.push(ball);
  Matter.Composite.add(engine.world, bodies);

  return { hole, engine, ball, platform, tick: 0, restSpot: { ...hole.tee }, stillTicks: 0, inFlight: false, sunk: false };
}

/** Launch velocity for a pull-back (the finger's offset from the ball). */
export function launchVelocity(pull: Point): Point {
  const vx = -pull.x * POWER;
  const vy = -pull.y * POWER;
  const speed = Math.hypot(vx, vy);
  const k = speed > MAX_SPEED ? MAX_SPEED / speed : 1;
  return { x: vx * k, y: vy * k };
}

export function isAtRest(world: GolfWorld): boolean {
  return !world.inFlight && !world.sunk;
}

export function shoot(world: GolfWorld, pull: Point) {
  if (!isAtRest(world)) return;
  Matter.Body.setVelocity(world.ball, launchVelocity(pull));
  Matter.Body.setAngularVelocity(world.ball, 0);
  world.inFlight = true;
  world.stillTicks = 0;
}

function respawn(world: GolfWorld) {
  Matter.Body.setPosition(world.ball, world.restSpot);
  Matter.Body.setVelocity(world.ball, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(world.ball, 0);
  world.inFlight = false;
  world.stillTicks = 0;
}

function inCup(world: GolfWorld): boolean {
  const { x, y } = world.ball.position;
  const { cup } = world.hole;
  return Math.abs(x - cup.x) < CUP.width / 2 && y > cup.y + 8;
}

function inWater(world: GolfWorld): boolean {
  const { x, y } = world.ball.position;
  return (world.hole.water ?? []).some((w) => x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h);
}

function offCourse(world: GolfWorld): boolean {
  const { x, y } = world.ball.position;
  return y > WORLD.height + 60 || x < -40 || x > WORLD.width + 40;
}

/** Advance one tick and report anything that happened. */
export function step(world: GolfWorld): GolfEvent {
  if (world.sunk) return "none";
  world.tick++;

  if (world.platform) {
    const x = platformX(world)!;
    const next = x + world.hole.movingPlatform!.w / 2;
    // Set the velocity too, so a ball resting on the plank rides along with it.
    Matter.Body.setVelocity(world.platform, { x: next - world.platform.position.x, y: 0 });
    Matter.Body.setPosition(world.platform, { x: next, y: world.platform.position.y });
  }

  Matter.Engine.update(world.engine, TICK_MS);

  if (inCup(world)) {
    world.sunk = true;
    world.inFlight = false;
    return "sunk";
  }
  if (inWater(world) || offCourse(world)) {
    respawn(world);
    return "lost";
  }

  const speed = Math.hypot(world.ball.velocity.x, world.ball.velocity.y);
  const onPlatform = world.platform && Math.abs(world.ball.position.y - (world.platform.position.y - 8 - BALL_RADIUS)) < 3;
  if (speed < REST_SPEED || (onPlatform && Math.abs(world.ball.velocity.y) < REST_SPEED)) {
    world.stillTicks++;
    if (world.stillTicks >= REST_TICKS && world.inFlight) {
      world.inFlight = false;
      world.restSpot = { ...world.ball.position };
      return "stopped";
    }
  } else {
    world.stillTicks = 0;
  }
  return "none";
}

/** Where the ball would fly, ignoring collisions: the dotted aiming line. */
export function predictPath(from: Point, pull: Point, ticks: number, every = 3): Point[] {
  const v = launchVelocity(pull);
  const g = 0.001 * TICK_MS * TICK_MS; // Matter's default gravity, per tick²
  const points: Point[] = [];
  for (let t = every; t <= ticks; t += every) {
    points.push({ x: from.x + v.x * t, y: from.y + v.y * t + 0.5 * g * t * t });
  }
  return points;
}

/** Play one shot from the tee to the end. Used by tests, and to check a hole is fair. */
export function simulateShot(hole: Hole, pull: Point, maxTicks = 900): GolfEvent {
  const world = createWorld(hole);
  shoot(world, pull);
  for (let i = 0; i < maxTicks; i++) {
    const event = step(world);
    if (event !== "none") return event;
  }
  return "none";
}
