import type { PieceType, Point, Segment } from "./pieces";

/**
 * The five marble run levels (spec §6.2), as data so more can be added.
 *
 * The world is 1000 × 560 units, y down. The marble drops from `drop`.
 * `walls` are fixed ramps and obstacles; `zones` are where the child may
 * build; `tray` lists the pieces on offer (possibly including a decoy);
 * `solution` is the intended build, which the tests replay to prove the
 * level works, and which the hint shows one piece of.
 */

export type Placement = { zone: number; type: PieceType; turns: number };

export type Level = {
  name: string;
  drop: Point;
  cup: { x: number; y: number; w: number };
  walls: Segment[];
  zones: Point[];
  tray: PieceType[];
  solution: Placement[];
  /** A bar that slides between two x positions, restarting on every GO. */
  mover?: { y: number; w: number; fromX: number; toX: number; speed: number };
};

export const WORLD = { width: 1000, height: 560 };
export const ZONE_SIZE = 150;
export const MARBLE_RADIUS = 11;

const seg = (x1: number, y1: number, x2: number, y2: number): Segment => [
  { x: x1, y: y1 },
  { x: x2, y: y2 },
];

export const LEVELS: Level[] = [
  {
    name: "One gap",
    drop: { x: 100, y: 40 },
    cup: { x: 930, y: 520, w: 80 },
    walls: [seg(60, 100, 430, 215), seg(690, 360, 925, 440), seg(975, 300, 975, 474)],
    zones: [{ x: 560, y: 290 }],
    tray: ["ramp", "curve"],
    solution: [{ zone: 0, type: "ramp", turns: 0 }],
  },
  {
    name: "Two gaps",
    drop: { x: 90, y: 40 },
    cup: { x: 930, y: 520, w: 80 },
    walls: [seg(50, 90, 300, 190), seg(500, 285, 640, 350), seg(840, 425, 925, 450), seg(975, 300, 975, 474)],
    zones: [{ x: 400, y: 245 }, { x: 740, y: 400 }],
    tray: ["ramp", "ramp", "funnel"],
    solution: [{ zone: 0, type: "ramp", turns: 0 }, { zone: 1, type: "ramp", turns: 0 }],
  },
  {
    name: "Turn around",
    drop: { x: 100, y: 30 },
    cup: { x: 125, y: 548, w: 100 },
    walls: [seg(60, 80, 330, 190), seg(530, 280, 690, 325), seg(750, 200, 750, 360), seg(650, 470, 380, 500), seg(75, 380, 75, 502)],
    zones: [{ x: 430, y: 245 }, { x: 680, y: 400 }, { x: 265, y: 505 }],
    tray: ["ramp", "curve", "ramp", "bouncer"],
    solution: [{ zone: 0, type: "curve", turns: 7 }, { zone: 1, type: "ramp", turns: 3 }, { zone: 2, type: "ramp", turns: 0 }],
  },
  {
    name: "Catch it",
    drop: { x: 470, y: 30 },
    cup: { x: 150, y: 548, w: 100 },
    walls: [seg(570, 215, 820, 265), seg(880, 170, 880, 390), seg(780, 440, 420, 470), seg(100, 380, 100, 502)],
    zones: [{ x: 470, y: 150 }, { x: 820, y: 370 }, { x: 300, y: 490 }],
    tray: ["ramp", "ramp", "curve", "funnel", "bouncer"],
    solution: [{ zone: 0, type: "curve", turns: 0 }, { zone: 1, type: "ramp", turns: 3 }, { zone: 2, type: "ramp", turns: 0 }],
  },
  {
    name: "The big run",
    drop: { x: 470, y: 20 },
    cup: { x: 75, y: 548, w: 100 },
    walls: [seg(560, 180, 790, 225), seg(860, 130, 860, 320), seg(765, 385, 600, 400), seg(400, 440, 290, 450), seg(22, 380, 22, 502)],
    zones: [{ x: 470, y: 120 }, { x: 805, y: 315 }, { x: 495, y: 420 }, { x: 190, y: 470 }],
    tray: ["curve", "ramp", "ramp", "ramp", "funnel", "bouncer"],
    solution: [
      { zone: 0, type: "curve", turns: 0 },
      { zone: 1, type: "ramp", turns: 3 },
      { zone: 2, type: "ramp", turns: 0 },
      { zone: 3, type: "ramp", turns: 0 },
    ],
    mover: { y: 392, w: 80, fromX: 380, toX: 560, speed: 1.2 },
  },
];
