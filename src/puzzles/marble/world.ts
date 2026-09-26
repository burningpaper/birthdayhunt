import Matter from "matter-js";
import { MARBLE_RADIUS, WORLD, type Level, type Placement } from "./levels";
import { BOUNCER_RADIUS, pieceSegments, type Point, type Segment } from "./pieces";

/**
 * A marble run's physics, with no drawing, so tests and the browser share
 * it. A fresh world is built for every GO from the level plus what the child
 * has placed, and stepped at a fixed 60 ticks a second: the same build
 * always does the same thing, moving obstacle included.
 */

export const TICK_MS = 1000 / 60;
const THICKNESS = 12;
const SETTLE_TICKS = 30;
const MAX_TICKS = 60 * 12;

export type RunResult = "running" | "cup" | "miss";

export type MarbleWorld = {
  level: Level;
  engine: Matter.Engine;
  marble: Matter.Body;
  mover?: Matter.Body;
  tick: number;
  settleTicks: number;
  stillTicks: number;
  result: RunResult;
};

function segmentBody(a: Point, b: Point, label: string): Matter.Body {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return Matter.Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, length + THICKNESS, THICKNESS, {
    isStatic: true,
    angle: Math.atan2(b.y - a.y, b.x - a.x),
    chamfer: { radius: THICKNESS / 2 - 0.5 }, // rounded ends, so the marble never snags on a corner
    friction: 0.02,
    restitution: 0.2,
    label,
  });
}

/** The cup's three sides, as segments (also used for drawing). */
export function cupSegments(level: Level): Segment[] {
  const { x, y, w } = level.cup;
  const h = 46;
  return [
    [{ x: x - w / 2, y: y - h }, { x: x - w / 2, y }],
    [{ x: x - w / 2, y }, { x: x + w / 2, y }],
    [{ x: x + w / 2, y }, { x: x + w / 2, y: y - h }],
  ];
}

export function moverX(level: Level, tick: number): number | null {
  const m = level.mover;
  if (!m) return null;
  const span = m.toX - m.fromX;
  const travelled = (tick * m.speed) % (span * 2);
  return m.fromX + (travelled <= span ? travelled : span * 2 - travelled);
}

export function createRun(level: Level, placed: Placement[]): MarbleWorld {
  const engine = Matter.Engine.create({ positionIterations: 10, velocityIterations: 8 });
  const bodies: Matter.Body[] = [];

  for (const [a, b] of level.walls) bodies.push(segmentBody(a, b, "wall"));
  for (const [a, b] of cupSegments(level)) bodies.push(segmentBody(a, b, "cup"));
  for (const p of placed) {
    const at = level.zones[p.zone];
    if (p.type === "bouncer") {
      bodies.push(Matter.Bodies.circle(at.x, at.y, BOUNCER_RADIUS, { isStatic: true, restitution: 1.1, label: "bouncer" }));
    } else {
      for (const [a, b] of pieceSegments(p.type, at, p.turns)) bodies.push(segmentBody(a, b, "piece"));
    }
  }

  let mover: Matter.Body | undefined;
  if (level.mover) {
    const m = level.mover;
    mover = Matter.Bodies.rectangle(m.fromX + m.w / 2, m.y, m.w, THICKNESS, { isStatic: true, chamfer: { radius: 5 }, label: "mover" });
    bodies.push(mover);
  }

  const marble = Matter.Bodies.circle(level.drop.x, level.drop.y, MARBLE_RADIUS, {
    restitution: 0.3,
    friction: 0.005,
    frictionStatic: 0.01,
    frictionAir: 0.0015,
    density: 0.004,
    label: "marble",
  });
  bodies.push(marble);
  Matter.Composite.add(engine.world, bodies);

  return { level, engine, marble, mover, tick: 0, settleTicks: 0, stillTicks: 0, result: "running" };
}

function inCup(world: MarbleWorld): boolean {
  const { x, y } = world.marble.position;
  const { cup } = world.level;
  return Math.abs(x - cup.x) < cup.w / 2 && y < cup.y && y > cup.y - 46;
}

/** Advance one tick. Returns the run's result so far. */
export function stepRun(world: MarbleWorld): RunResult {
  if (world.result !== "running") return world.result;
  world.tick++;

  if (world.mover) {
    const next = moverX(world.level, world.tick)! + world.level.mover!.w / 2;
    Matter.Body.setVelocity(world.mover, { x: next - world.mover.position.x, y: 0 });
    Matter.Body.setPosition(world.mover, { x: next, y: world.mover.position.y });
  }

  Matter.Engine.update(world.engine, TICK_MS);

  const { x, y } = world.marble.position;
  const speed = Math.hypot(world.marble.velocity.x, world.marble.velocity.y);

  if (inCup(world)) {
    world.settleTicks = speed < 0.6 ? world.settleTicks + 1 : 0;
    if (world.settleTicks >= SETTLE_TICKS) world.result = "cup";
    return world.result;
  }
  world.settleTicks = 0;

  // Off the screen, stuck somewhere, or simply taking too long: a miss.
  world.stillTicks = speed < 0.05 ? world.stillTicks + 1 : 0;
  if (y > WORLD.height + 40 || x < -40 || x > WORLD.width + 40 || world.stillTicks > 90 || world.tick > MAX_TICKS) {
    world.result = "miss";
  }
  return world.result;
}

/** Run a build to the end. For tests and level checks. */
export function simulateRun(level: Level, placed: Placement[]): RunResult {
  const world = createRun(level, placed);
  while (stepRun(world) === "running");
  return world.result;
}
