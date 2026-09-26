import { MARBLE_RADIUS, WORLD, ZONE_SIZE, type Level, type Placement } from "./levels";
import { BOUNCER_RADIUS, pieceSegments, type PieceType, type Point, type Segment } from "./pieces";
import { cupSegments, moverX } from "./world";

/**
 * Drawing a marble run frame onto a canvas, in world units. Toybox Plastic:
 * chunky rounded sticks with a highlight, one plastic colour per piece
 * type, and a glassy blue marble.
 */

export const PIECE_COLORS: Record<PieceType, { base: string; lip: string }> = {
  ramp: { base: "#FF8A1F", lip: "#B8600F" },
  curve: { base: "#F0508F", lip: "#A8325F" },
  funnel: { base: "#22A94F", lip: "#157A38" },
  bouncer: { base: "#FFC21A", lip: "#B8860B" },
};

const WALL = { base: "#C9D4F2", lip: "#7F8BA6" };
const CUP = { base: "#3CCB6A", lip: "#157A38" };

export type Frame = {
  level: Level;
  placed: Placement[];
  marble: Point | null;
  tick: number;
  /** A ghost of one correct piece (the hint). */
  ghost: Placement | null;
  /** The zone under a piece being dragged. */
  hoverZone: number | null;
  time: number;
};

function stick(ctx: CanvasRenderingContext2D, [a, b]: Segment, color: { base: string; lip: string }, width = 12) {
  ctx.lineCap = "round";
  ctx.strokeStyle = color.lip;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y + 3);
  ctx.lineTo(b.x, b.y + 3);
  ctx.stroke();
  ctx.strokeStyle = color.base;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  // Gloss along the top.
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = width * 0.25;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - width * 0.18);
  ctx.lineTo(b.x, b.y - width * 0.18);
  ctx.stroke();
}

function drawPiece(ctx: CanvasRenderingContext2D, level: Level, p: Placement, alpha = 1) {
  const at = level.zones[p.zone];
  const color = PIECE_COLORS[p.type];
  ctx.globalAlpha = alpha;
  if (p.type === "bouncer") {
    ctx.fillStyle = color.lip;
    ctx.beginPath();
    ctx.arc(at.x, at.y + 3, BOUNCER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(at.x - 7, at.y - 8, 2, at.x, at.y, BOUNCER_RADIUS);
    g.addColorStop(0, "#FFE58A");
    g.addColorStop(1, color.base);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(at.x, at.y, BOUNCER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (const segment of pieceSegments(p.type, at, p.turns)) stick(ctx, segment, color, 13);
  }
  ctx.globalAlpha = 1;
}

function drawZone(ctx: CanvasRenderingContext2D, at: Point, state: "empty" | "filled" | "hover") {
  const half = ZONE_SIZE / 2;
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = state === "hover" ? 4 : 3;
  ctx.strokeStyle = state === "hover" ? "rgba(255,194,26,1)" : state === "empty" ? "rgba(255,194,26,0.6)" : "rgba(255,247,232,0.14)";
  ctx.fillStyle = state === "hover" ? "rgba(255,194,26,0.14)" : state === "empty" ? "rgba(255,194,26,0.05)" : "transparent";
  ctx.beginPath();
  ctx.roundRect(at.x - half, at.y - half, ZONE_SIZE, ZONE_SIZE, 18);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMarble(ctx: CanvasRenderingContext2D, at: Point) {
  const g = ctx.createRadialGradient(at.x - 4, at.y - 5, 1, at.x, at.y, MARBLE_RADIUS);
  g.addColorStop(0, "#DDE8FF");
  g.addColorStop(0.35, "#5B8CF5");
  g.addColorStop(1, "#1F4FC2");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(at.x, at.y, MARBLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

export function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame) {
  const { level, placed, marble, tick, ghost, hoverZone, time } = frame;
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  level.zones.forEach((z, i) => drawZone(ctx, z, hoverZone === i ? "hover" : placed.some((p) => p.zone === i) ? "filled" : "empty"));

  // The drop chute the marble starts in.
  ctx.fillStyle = "rgba(255,247,232,0.2)";
  ctx.beginPath();
  ctx.roundRect(level.drop.x - 20, level.drop.y - 26, 40, 36, 10);
  ctx.fill();

  for (const wall of level.walls) stick(ctx, wall, WALL);
  for (const side of cupSegments(level)) stick(ctx, side, CUP, 14);

  const mx = moverX(level, tick);
  if (mx !== null && level.mover) {
    stick(ctx, [{ x: mx, y: level.mover.y }, { x: mx + level.mover.w, y: level.mover.y }], { base: "#F0453A", lip: "#A82A22" }, 14);
  }

  for (const p of placed) drawPiece(ctx, level, p);
  if (ghost) drawPiece(ctx, level, ghost, 0.35 + ((Math.sin(time / 220) + 1) / 2) * 0.35);

  drawMarble(ctx, marble ?? level.drop);
}
