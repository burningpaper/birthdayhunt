import Matter from "matter-js";
import { BALL_RADIUS, CUP, WORLD, type Hole, type Point, type Rect, type Windmill } from "./holes";

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
/** Rolling along a bunker's floor, the ball keeps this much of its speed each tick. */
const SAND_GRIP = 0.8;
/** Sand only grips a ball that's down on its floor (within this much of resting there)... */
const SAND_FLOOR_BAND = 8;
/** ...and not in the first moments of a shot, so a proper hit blasts out rather than dying on the spot. */
const SAND_GRACE_TICKS = 12;
/** The edges of the course: invisible-physics rails the ball bounces off, drawn as plastic strips. */
export const RAIL = 6;

export type GolfEvent = "none" | "sunk" | "lost" | "stopped";

export type GolfWorld = {
  hole: Hole;
  engine: Matter.Engine;
  ball: Matter.Body;
  platform?: Matter.Body;
  windmill?: Matter.Body;
  tick: number;
  /** The tick of the last shot (for the sand's grace period). */
  shotAt: number;
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

/** How many ticks until the windmill looks the same again (one blade's share of a turn). */
export function windmillPeriod(windmill: Windmill): number {
  return windmill.period;
}

/** Radians per tick. */
export function windmillSpeed(windmill: Windmill): number {
  return (Math.PI * 2) / windmill.blades / windmill.period;
}

export function windmillAngle(windmill: Windmill, tick: number): number {
  return windmillSpeed(windmill) * (tick % (windmill.period * windmill.blades));
}

/** The blades as one rigid body turning about the hub. */
function windmillBody(w: Windmill): Matter.Body {
  const parts = Array.from({ length: w.blades }, (_, i) => {
    const a = (i * Math.PI * 2) / w.blades;
    return Matter.Bodies.rectangle(w.x + (Math.cos(a) * w.arm) / 2, w.y + (Math.sin(a) * w.arm) / 2, w.arm, 16, { angle: a });
  });
  const body = Matter.Body.create({ parts, isStatic: true, friction: 0.2, restitution: 0.5, label: "windmill" });
  Matter.Body.setPosition(body, { x: w.x, y: w.y }); // turn about the hub, not the parts' centroid
  return body;
}

function inside(p: Point, r: Rect): boolean {
  return p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
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

  for (const wall of hole.walls ?? []) {
    bodies.push(Matter.Bodies.rectangle(wall.x + wall.w / 2, wall.y + wall.h / 2, wall.w, wall.h, { isStatic: true, chamfer: { radius: 6 }, friction: 0.6, restitution: 0.35, label: "wall" }));
  }
  // Rails at both sides, reaching far above the screen: a ball can't end up hidden off the edge.
  for (const x of [RAIL - 30, WORLD.width - RAIL]) {
    bodies.push(Matter.Bodies.rectangle(x + 15, WORLD.height / 2 - 600, 30, WORLD.height + 1400, { isStatic: true, friction: 0.8, restitution: 0, label: "rail" }));
  }
  const windmill = hole.windmill ? windmillBody(hole.windmill) : undefined;
  if (windmill) bodies.push(windmill);

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

  return { hole, engine, ball, platform, windmill, tick: 0, shotAt: -Infinity, restSpot: { ...hole.tee }, stillTicks: 0, inFlight: false, sunk: false };
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
  world.shotAt = world.tick;
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

  if (world.windmill && world.hole.windmill) {
    // Turn it by setting the angle each tick (deterministic), with a matching spin so a hit ball is batted, not just blocked.
    Matter.Body.setAngle(world.windmill, windmillAngle(world.hole.windmill, world.tick));
    Matter.Body.setAngularVelocity(world.windmill, windmillSpeed(world.hole.windmill));
  }

  // Wind pushes; sand grabs.
  const at = world.ball.position;
  for (const zone of world.hole.wind ?? []) {
    if (inside(at, zone)) Matter.Body.setVelocity(world.ball, { x: world.ball.velocity.x + zone.push.x, y: world.ball.velocity.y + zone.push.y });
  }
  const settledIn = (zone: Rect) => inside(at, zone) && at.y >= zone.y + zone.h - BALL_RADIUS - SAND_FLOOR_BAND;
  if (world.tick - world.shotAt > SAND_GRACE_TICKS && (world.hole.sand ?? []).some(settledIn)) {
    Matter.Body.setVelocity(world.ball, { x: world.ball.velocity.x * SAND_GRIP, y: world.ball.velocity.y * SAND_GRIP });
  }

  const headingX = world.ball.velocity.x;
  Matter.Engine.update(world.engine, TICK_MS);

  // The rails catch like a net: a ball that just bounced off one (heading into it before this step, away
  // after) drops beside it and waits, rather than bouncing back into play. A shot away from a rail isn't a bounce.
  const { x: bx, y: by } = world.ball.position;
  const vx = world.ball.velocity.x;
  const offLeft = bx <= RAIL + BALL_RADIUS + 2 && headingX < 0 && vx > 0;
  const offRight = bx >= WORLD.width - RAIL - BALL_RADIUS - 2 && headingX > 0 && vx < 0;
  if (offLeft || offRight) {
    Matter.Body.setVelocity(world.ball, { x: 0, y: world.ball.velocity.y });
    Matter.Body.setPosition(world.ball, { x: bx, y: by });
  }

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

/** Play one shot from the tee to the end, released `wait` ticks after the hole starts. Used by tests, and to check a hole is fair. */
export function simulateShot(hole: Hole, pull: Point, maxTicks = 900, wait = 0): GolfEvent {
  const world = createWorld(hole);
  for (let i = 0; i < wait; i++) step(world);
  shoot(world, pull);
  for (let i = 0; i < maxTicks; i++) {
    const event = step(world);
    if (event !== "none") return event;
  }
  return "none";
}
