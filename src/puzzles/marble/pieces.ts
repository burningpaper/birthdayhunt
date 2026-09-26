/**
 * The marble run's buildable pieces, as outlines in their own local space
 * (centred on the origin, y down). Rotation is in 45° steps. Every piece is
 * a set of line segments, so drawing and physics share one description.
 */

export type PieceType = "ramp" | "curve" | "funnel" | "bouncer";
export type Point = { x: number; y: number };
export type Segment = [Point, Point];

export const PIECE_TYPES: PieceType[] = ["ramp", "curve", "funnel", "bouncer"];
export const BOUNCER_RADIUS = 22;

/** The curve: a quarter-circle chute, arcing from pointing down to pointing right. */
function curveSegments(): Segment[] {
  const r = 75;
  const centre = { x: 37, y: -37 };
  const points: Point[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI - (i / 8) * (Math.PI / 2); // 180° → 90°, i.e. from the left side down to the bottom
    points.push({ x: centre.x + r * Math.cos(a), y: centre.y + r * Math.sin(a) });
  }
  return points.slice(1).map((p, i) => [points[i], p]);
}

const SHAPES: Record<Exclude<PieceType, "bouncer">, Segment[]> = {
  ramp: [[{ x: -80, y: 0 }, { x: 80, y: 0 }]],
  curve: curveSegments(),
  funnel: [
    [{ x: -70, y: -45 }, { x: -15, y: 20 }],
    [{ x: 70, y: -45 }, { x: 15, y: 20 }],
  ],
};

function rotate(p: Point, turns: number): Point {
  const a = (turns * Math.PI) / 4;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
}

/** A piece's segments in world space, placed at `at` and turned by `turns` × 45°. */
export function pieceSegments(type: PieceType, at: Point, turns: number): Segment[] {
  if (type === "bouncer") return [];
  return SHAPES[type].map(([a, b]) => {
    const ra = rotate(a, turns);
    const rb = rotate(b, turns);
    return [
      { x: at.x + ra.x, y: at.y + ra.y },
      { x: at.x + rb.x, y: at.y + rb.y },
    ];
  });
}

/** Rotations that look different for each piece (a bouncer is round; a ramp repeats every half turn). */
export function distinctTurns(type: PieceType): number[] {
  if (type === "bouncer") return [0];
  if (type === "ramp") return [0, 1, 2, 3];
  return [0, 1, 2, 3, 4, 5, 6, 7];
}

/** The same orientation, whichever way round it was reached. */
export function sameOrientation(type: PieceType, a: number, b: number): boolean {
  if (type === "bouncer") return true;
  const period = type === "ramp" ? 4 : 8;
  return (((a - b) % period) + period) % period === 0;
}
