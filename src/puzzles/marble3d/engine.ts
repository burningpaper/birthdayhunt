import type { Level, Placed } from "./levels";
import { MARBLE_RADIUS, cellCentre, placedPath, type CellRef, type PieceType, type Side, type Vec3 } from "./track";

/**
 * The marble's journey, worked out in full the moment GO is pressed, then
 * played back by the 3D view. No physics engine: the marble rolls *along*
 * the pieces' centre lines, speeding up downhill and slowing uphill (and a
 * little always, from rolling friction). Too slow to climb? It rolls back.
 * Reach an opening with nothing that fits on the other side? It flies off
 * in a real arc and bounces on the table. The same build always does the
 * same thing, which is what lets the tests prove every level.
 *
 * Stars: the marble collects one by rolling into its cell. Landing in the
 * bucket only counts once it has every star; otherwise it still drops in,
 * but the run is a miss ("stars").
 */

/** Gravity, in cells per second², slowed down from real life so a child can follow the marble. */
export const GRAVITY = 9;
/** Rolling friction, as a steady slowing in cells per second². */
const FRICTION = 0.3;
/** Rubbing round a bend costs a little speed: the share of it kept, per piece. */
const KEEP_THROUGH: Record<PieceType, number> = { straight: 1, curve: 0.9, loop: 0.95 };
export const TICK = 1 / 60;
const MAX_TICKS = 60 * 30;
/** Stopped for this long counts as stuck. */
const STUCK_TICKS = 45;
/** How long a flying or bucketed marble is followed before the run ends. */
const FLIGHT_TICKS = 60 * 2.2;
const SETTLE_TICKS = 50;
/** A marble leaving the track pops slightly towards the player, so it falls in front of the other pieces. */
const POP_TOWARDS_PLAYER = 1.2;
const BOUNCE = 0.45;
/** The table the board stands on: level with the board's bottom edge. */
export const TABLE_Y = -0.3;

export type RunResult = "cup" | "miss";
export type RunEvent = { tick: number; kind: "join" | "fly" | "bounce" | "cup" | "back" | "star"; cell?: CellRef };
export type Run = { frames: Vec3[]; result: RunResult; reason: "cup" | "flew" | "stuck" | "stars"; events: RunEvent[] };

type Track = { type: PieceType; ends: [Side, Side]; points: Vec3[]; lengths: number[] };

const OPPOSITE: Record<Side, Side> = { L: "R", R: "L", T: "B", B: "T" };
const STEP: Record<Side, CellRef> = { L: { col: -1, row: 0 }, R: { col: 1, row: 0 }, T: { col: 0, row: -1 }, B: { col: 0, row: 1 } };

const key = (c: CellRef) => `${c.col},${c.row}`;

function track(type: PieceType, turns: number, cell: CellRef, rows: number): Track {
  const { ends, points } = placedPath(type, turns, cell, rows);
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    lengths.push(lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  return { type, ends, points, lengths };
}

/**
 * Every cell's track: the level's fixed pieces, what the child placed, and
 * the start tube, which is an upright straight in an imaginary row above
 * the board (row -1), so a marble that rolls back up it simply falls again.
 */
export function boardTracks(level: Level, placed: Placed[]): Map<string, Track> {
  const tracks = new Map<string, Track>();
  const startCell = { col: level.start, row: -1 };
  tracks.set(key(startCell), track("straight", 1, startCell, level.rows));
  for (const p of [...level.fixed, ...placed]) tracks.set(key(p), track(p.type, p.turns, p, level.rows));
  return tracks;
}

function length(t: Track) {
  return t.lengths[t.lengths.length - 1];
}

/** The point `s` along a track, and which way the track runs there. */
function pointAt(t: Track, s: number): { at: Vec3; dir: Vec3 } {
  let i = 1;
  while (i < t.lengths.length - 1 && t.lengths[i] < s) i++;
  const a = t.points[i - 1];
  const b = t.points[i];
  const span = t.lengths[i] - t.lengths[i - 1] || 1;
  const f = Math.min(Math.max((s - t.lengths[i - 1]) / span, 0), 1);
  return {
    at: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f },
    dir: { x: (b.x - a.x) / span, y: (b.y - a.y) / span, z: (b.z - a.z) / span },
  };
}

function inCup(level: Level, cell: CellRef) {
  return cell.col === level.cup.col && cell.row === level.cup.row;
}

export function simulate(level: Level, placed: Placed[]): Run {
  const tracks = boardTracks(level, placed);
  const frames: Vec3[] = [];
  const events: RunEvent[] = [];

  // On the track: which cell, how far along its path, which way (+1 towards its last point), and how fast.
  let cell: CellRef = { col: level.start, row: -1 };
  let t = tracks.get(key(cell))!;
  let s = length(t) / 2;
  let way: 1 | -1 = -1; // the start tube runs bottom to top; the marble heads down
  let speed = 0;
  let still = 0;
  const starsLeft = new Set(level.stars.map(key));

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    const here = pointAt(t, s);
    frames.push(here.at);

    // Gravity along the way the marble is going, then rolling friction.
    speed += -GRAVITY * here.dir.y * way * TICK;
    if (speed < 0) {
      way = way === 1 ? -1 : 1;
      speed = -speed;
      events.push({ tick, kind: "back" });
    }
    speed = Math.max(0, speed - FRICTION * TICK);
    still = speed < 0.02 ? still + 1 : 0;
    if (still > STUCK_TICKS) return { frames, result: "miss", reason: "stuck", events };

    let move = speed * TICK;
    while (move > 0) {
      const room = way === 1 ? length(t) - s : s;
      if (move <= room) {
        s += move * way;
        break;
      }
      move -= room;
      s = way === 1 ? length(t) : 0;

      // Out through an opening: into the next cell, if something there fits.
      const side = way === 1 ? t.ends[1] : t.ends[0];
      const exit = pointAt(t, s);
      const velocity = { x: exit.dir.x * way * speed, y: exit.dir.y * way * speed, z: exit.dir.z * way * speed };
      const next = { col: cell.col + STEP[side].col, row: cell.row + STEP[side].row };
      const enter = OPPOSITE[side];

      if (inCup(level, next) && enter !== "B") {
        events.push({ tick, kind: "cup" });
        return catchInBucket(level, exit.at, velocity, frames, events, tick, starsLeft.size === 0);
      }
      const nextTrack = tracks.get(key(next));
      if (!nextTrack || !nextTrack.ends.includes(enter)) {
        events.push({ tick, kind: "fly" });
        return flyOff(exit.at, velocity, frames, events, tick);
      }
      events.push({ tick, kind: "join" });
      if (starsLeft.delete(key(next))) events.push({ tick, kind: "star", cell: next });
      cell = next;
      t = nextTrack;
      speed *= KEEP_THROUGH[t.type];
      if (t.ends[0] === enter) {
        s = 0;
        way = 1;
      } else {
        s = length(t);
        way = -1;
      }
    }
  }
  return { frames, result: "miss", reason: "stuck", events };
}

/** Off the track: a free arc, popping gently towards the player, bouncing on the table until it's rolled away. */
function flyOff(from: Vec3, velocity: Vec3, frames: Vec3[], events: RunEvent[], tick: number): Run {
  const p = { ...from };
  const v = { ...velocity, z: velocity.z + POP_TOWARDS_PLAYER };
  for (let i = 0; i < FLIGHT_TICKS; i++) {
    v.y -= GRAVITY * TICK;
    p.x += v.x * TICK;
    p.y += v.y * TICK;
    p.z += v.z * TICK;
    if (p.y < TABLE_Y + MARBLE_RADIUS) {
      p.y = TABLE_Y + MARBLE_RADIUS;
      if (v.y < -0.8) events.push({ tick: tick + i, kind: "bounce" });
      v.y = -v.y * BOUNCE;
      v.x *= 0.85;
      v.z *= 0.85;
    }
    frames.push({ ...p });
  }
  return { frames, result: "miss", reason: "flew", events };
}

/** Into the bucket: a short arc, rattling off its sides, then settling on the bottom. */
function catchInBucket(level: Level, from: Vec3, velocity: Vec3, frames: Vec3[], events: RunEvent[], tick: number, allStars: boolean): Run {
  const c = cellCentre(level.cup, level.rows);
  const floor = c.y - 0.46 + MARBLE_RADIUS + 0.02;
  const wall = 0.26 - MARBLE_RADIUS;
  const p = { ...from };
  const v = { ...velocity };
  let settled = 0;
  for (let i = 0; i < FLIGHT_TICKS && settled < SETTLE_TICKS; i++) {
    v.y -= GRAVITY * TICK;
    p.x += v.x * TICK;
    p.y += v.y * TICK;
    p.z += (0 - p.z) * 0.2;
    // Once it's dropped below the rim, the bucket's sides keep it in.
    if (p.y < c.y - 0.1 && Math.abs(p.x - c.x) > wall) {
      p.x = c.x + Math.sign(p.x - c.x) * wall;
      v.x = -v.x * BOUNCE;
    }
    if (p.y < floor) {
      p.y = floor;
      if (v.y < -0.8) events.push({ tick: tick + i, kind: "bounce" });
      v.y = -v.y * BOUNCE;
      v.x *= 0.7;
    }
    settled = Math.abs(v.y) < 0.3 && p.y - floor < 0.01 ? settled + 1 : 0;
    frames.push({ ...p });
  }
  return allStars ? { frames, result: "cup", reason: "cup", events } : { frames, result: "miss", reason: "stars", events };
}
