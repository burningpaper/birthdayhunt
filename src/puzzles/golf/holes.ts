/**
 * The Flick Golf course (spec §6.5), as data so holes are easy to add.
 *
 * The world is 1000 × 560 units, side-on, y pointing down. Ground is one or
 * more polylines ("islands") traced left to right along the surface; the
 * solid side is below. A gap between islands is a drop to clear. Each hole
 * also carries a known sinking shot from the tee (`testShot`, a pull-back
 * in world units), which the tests replay to prove the hole can be sunk.
 */

export type Point = { x: number; y: number };

export type Hole = {
  name: string;
  tee: Point;
  /** Centre of the cup's rim; the cup is cut into the ground below it. */
  cup: Point;
  islands: Point[][];
  water?: { x: number; y: number; w: number; h: number }[];
  bouncePads?: { x: number; y: number; w: number }[];
  /** A plank that slides back and forth between two x positions. */
  movingPlatform?: { y: number; w: number; fromX: number; toX: number; speed: number };
  testShot: Point;
};

export const WORLD = { width: 1000, height: 560 };
export const CUP = { width: 52, depth: 34 };
export const BALL_RADIUS = 11;

/** Ground with the cup cut in at `cupX`, for a flat stretch at height `y`. */
function withCup(points: Point[], cupX: number, y: number): Point[] {
  const half = CUP.width / 2;
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    out.push(points[i]);
    const next = points[i + 1];
    if (next && points[i].y === y && next.y === y && points[i].x < cupX && next.x > cupX) {
      out.push({ x: cupX - half, y }, { x: cupX - half, y: y + CUP.depth }, { x: cupX + half, y: y + CUP.depth }, { x: cupX + half, y });
    }
  }
  return out;
}

export const HOLES: Hole[] = [
  {
    name: "The warm-up",
    tee: { x: 140, y: 440 - BALL_RADIUS },
    cup: { x: 760, y: 440 },
    islands: [withCup([{ x: -100, y: 440 }, { x: 1100, y: 440 }], 760, 440)],
    testShot: { x: -77, y: 67 },
  },
  {
    name: "Over the hill",
    tee: { x: 120, y: 440 - BALL_RADIUS },
    cup: { x: 840, y: 440 },
    islands: [
      withCup(
        [
          { x: -100, y: 440 },
          { x: 360, y: 440 },
          { x: 470, y: 330 },
          { x: 560, y: 330 },
          { x: 670, y: 440 },
          { x: 1100, y: 440 },
        ],
        840,
        440,
      ),
    ],
    testShot: { x: -69, y: 95 },
  },
  {
    name: "Mind the gap",
    tee: { x: 120, y: 450 - BALL_RADIUS },
    cup: { x: 800, y: 450 },
    islands: [
      [
        { x: -100, y: 450 },
        { x: 420, y: 450 },
        { x: 420, y: 700 },
      ],
      withCup(
        [
          { x: 600, y: 700 },
          { x: 600, y: 450 },
          { x: 1100, y: 450 },
        ],
        800,
        450,
      ),
    ],
    testShot: { x: -65, y: 113 },
  },
  {
    name: "Splash and bounce",
    tee: { x: 100, y: 440 - BALL_RADIUS },
    cup: { x: 830, y: 440 },
    islands: [
      withCup(
        [
          { x: -100, y: 440 },
          { x: 380, y: 440 },
          { x: 380, y: 520 },
          { x: 620, y: 520 },
          { x: 620, y: 440 },
          { x: 1100, y: 440 },
        ],
        830,
        440,
      ),
    ],
    water: [{ x: 380, y: 470, w: 240, h: 50 }],
    bouncePads: [{ x: 250, y: 440, w: 70 }],
    testShot: { x: -66, y: 124 },
  },
  {
    name: "The moving bridge",
    tee: { x: 110, y: 440 - BALL_RADIUS },
    cup: { x: 880, y: 360 },
    islands: [
      [
        { x: -100, y: 440 },
        { x: 360, y: 440 },
        { x: 360, y: 700 },
      ],
      withCup(
        [
          { x: 700, y: 700 },
          { x: 700, y: 360 },
          { x: 1100, y: 360 },
        ],
        880,
        360,
      ),
    ],
    movingPlatform: { y: 420, w: 120, fromX: 420, toX: 640, speed: 1.4 },
    testShot: { x: -92, y: 136 },
  },
];

/** The holes to play for a station: the first `count`, in order. */
export function holesFor(count: number): Hole[] {
  return HOLES.slice(0, Math.max(1, Math.min(count, HOLES.length)));
}
