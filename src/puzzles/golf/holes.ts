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
export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Spinning blades on a hub; a blade pointing down blocks the way. `period` is
 * how many ticks until the next blade takes the same place (a whole number,
 * so the pattern repeats exactly); the blades turn clockwise on screen, so
 * the lowest one sweeps back towards the tee.
 */
export type Windmill = { x: number; y: number; arm: number; blades: number; period: number };

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
  /** Solid plastic blocks: walls to lob over, low roofs to skim under. */
  walls?: Rect[];
  /** Sand traps: the ball slows right down inside one. */
  sand?: Rect[];
  /** Wind: while the ball is inside, `push` is added to its velocity every tick. */
  wind?: (Rect & { push: Point })[];
  windmill?: Windmill;
  /**
   * A known sinking shot from the tee: the pull-back, and for holes with a
   * windmill, the ticks (counted within one blade's turn) when releasing it works.
   */
  testShot: Point & { phase?: [number, number] };
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
    testShot: { x: -162, y: 0 },
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
    testShot: { x: -162, y: 9 },
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
    testShot: { x: -117, y: 78 },
  },
  {
    name: "Sand trap",
    tee: { x: 120, y: 440 - BALL_RADIUS },
    cup: { x: 820, y: 440 },
    islands: [
      withCup(
        [
          { x: -100, y: 440 },
          { x: 520, y: 440 },
          { x: 545, y: 462 },
          { x: 735, y: 462 },
          { x: 760, y: 440 },
          { x: 1100, y: 440 },
        ],
        820,
        440,
      ),
    ],
    sand: [{ x: 525, y: 400, w: 230, h: 66 }],
    testShot: { x: -102, y: 96 },
  },
  {
    name: "The wall",
    tee: { x: 120, y: 440 - BALL_RADIUS },
    cup: { x: 800, y: 440 },
    islands: [withCup([{ x: -100, y: 440 }, { x: 1100, y: 440 }], 800, 440)],
    walls: [{ x: 460, y: 240, w: 44, h: 200 }],
    testShot: { x: -93, y: 105 },
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
    testShot: { x: -102, y: 102 },
  },
  {
    name: "Under the roof",
    tee: { x: 110, y: 440 - BALL_RADIUS },
    cup: { x: 820, y: 440 },
    islands: [
      withCup(
        [
          { x: -100, y: 440 },
          { x: 340, y: 440 },
          { x: 360, y: 460 },
          { x: 500, y: 460 },
          { x: 520, y: 440 },
          { x: 1100, y: 440 },
        ],
        820,
        440,
      ),
    ],
    sand: [{ x: 345, y: 400, w: 170, h: 64 }],
    walls: [{ x: 580, y: 334, w: 440, h: 24 }],
    testShot: { x: -93, y: 66 },
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
    testShot: { x: -162, y: 108 },
  },
  {
    name: "Headwind",
    tee: { x: 110, y: 440 - BALL_RADIUS },
    cup: { x: 820, y: 440 },
    islands: [
      [
        { x: -100, y: 440 },
        { x: 380, y: 440 },
        { x: 380, y: 700 },
      ],
      withCup(
        [
          { x: 600, y: 700 },
          { x: 600, y: 440 },
          { x: 1100, y: 440 },
        ],
        820,
        440,
      ),
    ],
    wind: [{ x: 200, y: -400, w: 700, h: 700, push: { x: -0.16, y: 0 } }],
    testShot: { x: -162, y: 114 },
  },
  {
    name: "The windmill",
    tee: { x: 120, y: 440 - BALL_RADIUS },
    cup: { x: 860, y: 440 },
    islands: [withCup([{ x: -100, y: 440 }, { x: 1100, y: 440 }], 860, 440)],
    windmill: { x: 620, y: 300, arm: 134, blades: 4, period: 60 },
    walls: [
      // The windmill's tower: too tall to lob over, so the only way is under the turning blades.
      { x: 560, y: -400, w: 120, h: 640 },
      // A low backstop behind the cup: getting through is the test, not judging the roll after.
      { x: 910, y: 400, w: 30, h: 40 },
    ],
    testShot: { x: -144, y: 27, phase: [49, 59] },
  },
  {
    name: "Over and under",
    tee: { x: 110, y: 440 - BALL_RADIUS },
    cup: { x: 840, y: 440 },
    islands: [withCup([{ x: -100, y: 440 }, { x: 1100, y: 440 }], 840, 440)],
    walls: [
      { x: 360, y: 290, w: 40, h: 150 },
      { x: 580, y: 330, w: 440, h: 24 },
    ],
    testShot: { x: -78, y: 90 },
  },
  {
    name: "The grand finale",
    tee: { x: 90, y: 440 - BALL_RADIUS },
    cup: { x: 900, y: 440 },
    islands: [
      withCup(
        [
          { x: -100, y: 440 },
          { x: 260, y: 440 },
          { x: 280, y: 462 },
          { x: 420, y: 462 },
          { x: 440, y: 440 },
          { x: 1100, y: 440 },
        ],
        900,
        440,
      ),
    ],
    sand: [{ x: 265, y: 400, w: 170, h: 66 }],
    wind: [{ x: 440, y: -200, w: 340, h: 520, push: { x: -0.06, y: 0 } }],
    windmill: { x: 700, y: 300, arm: 134, blades: 4, period: 54 },
    walls: [
      { x: 640, y: -400, w: 120, h: 640 },
      { x: 950, y: 400, w: 30, h: 40 },
    ],
    testShot: { x: -162, y: 45, phase: [40, 48] },
  },
];

/** The holes to play for a station: the first `count`, in order. */
export function holesFor(count: number): Hole[] {
  return HOLES.slice(0, Math.max(1, Math.min(count, HOLES.length)));
}
