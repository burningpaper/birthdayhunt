import { BALL_RADIUS, CUP, WORLD, type Hole, type Point } from "./holes";

/**
 * Drawing one frame of Flick Golf onto a canvas, in world units (the caller
 * sets up the scale). Toybox Plastic: glossy grass with a lighter rim and a
 * darker lip, a white ball, a red flag, and cream aiming dots.
 */

const COLORS = {
  grassTop: "#3CCB6A",
  grass: "#22A94F",
  grassDeep: "#157A38",
  rim: "rgba(255,255,255,0.55)",
  cup: "#0B1430",
  water: "#2F6BEA",
  waterTop: "#8FB2FF",
  pad: "#F0508F",
  plank: "#FF8A1F",
  flag: "#F0453A",
  cream: "#FFF7E8",
  ink: "#14213F",
};

export type Frame = {
  hole: Hole;
  ball: Point;
  platformX: number | null;
  aim: { pull: Point; dots: Point[] } | null;
  /** Pulse the "grab me" ring when the ball is waiting for a shot. */
  ready: boolean;
  time: number;
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawIsland(ctx: CanvasRenderingContext2D, points: Point[]) {
  const bottom = WORLD.height + 120;
  const gradient = ctx.createLinearGradient(0, 300, 0, WORLD.height);
  gradient.addColorStop(0, COLORS.grassTop);
  gradient.addColorStop(0.25, COLORS.grass);
  gradient.addColorStop(1, COLORS.grassDeep);

  ctx.beginPath();
  ctx.moveTo(points[0].x, bottom);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.lineTo(points[points.length - 1].x, bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Rim light along the surface: the plastic's glossy edge.
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y + 2) : ctx.lineTo(p.x, p.y + 2)));
  ctx.strokeStyle = COLORS.rim;
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.stroke();
}

function drawCupAndFlag(ctx: CanvasRenderingContext2D, cup: Point, time: number) {
  ctx.fillStyle = COLORS.cup;
  roundRect(ctx, cup.x - CUP.width / 2 + 2, cup.y + 2, CUP.width - 4, CUP.depth - 2, 6);
  ctx.fill();

  const top = cup.y - 110;
  ctx.strokeStyle = COLORS.cream;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cup.x, cup.y + 4);
  ctx.lineTo(cup.x, top);
  ctx.stroke();

  // The flag flutters a little.
  const wave = Math.sin(time / 240) * 6;
  ctx.fillStyle = COLORS.flag;
  ctx.beginPath();
  ctx.moveTo(cup.x + 2, top);
  ctx.quadraticCurveTo(cup.x + 30, top + 8 + wave, cup.x + 58, top + 18);
  ctx.quadraticCurveTo(cup.x + 30, top + 26 - wave, cup.x + 2, top + 38);
  ctx.closePath();
  ctx.fill();
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Point) {
  ctx.fillStyle = "rgba(8,14,36,0.35)";
  ctx.beginPath();
  ctx.ellipse(ball.x + 2, ball.y + BALL_RADIUS + 2, BALL_RADIUS * 0.9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  const shine = ctx.createRadialGradient(ball.x - 4, ball.y - 5, 1, ball.x, ball.y, BALL_RADIUS);
  shine.addColorStop(0, "#FFFFFF");
  shine.addColorStop(0.7, "#F1ECE2");
  shine.addColorStop(1, "#C9C1B2");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

export function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame) {
  const { hole, ball, platformX, aim, ready, time } = frame;
  ctx.clearRect(-200, -200, WORLD.width + 400, WORLD.height + 400);

  for (const water of hole.water ?? []) {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(water.x, water.y, water.w, water.h + 60);
    ctx.fillStyle = COLORS.waterTop;
    for (let x = water.x; x < water.x + water.w; x += 24) {
      ctx.fillRect(x + ((time / 30) % 24), water.y + 4 + Math.sin((x + time / 6) / 20) * 2, 12, 3);
    }
  }

  for (const island of hole.islands) drawIsland(ctx, island);
  drawCupAndFlag(ctx, hole.cup, time);

  for (const pad of hole.bouncePads ?? []) {
    ctx.fillStyle = COLORS.pad;
    roundRect(ctx, pad.x, pad.y - 12, pad.w, 14, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    roundRect(ctx, pad.x + 6, pad.y - 10, pad.w - 12, 4, 2);
    ctx.fill();
  }

  if (platformX !== null && hole.movingPlatform) {
    const p = hole.movingPlatform;
    ctx.fillStyle = "#B8600F";
    roundRect(ctx, platformX, p.y + 4, p.w, 16, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.plank;
    roundRect(ctx, platformX, p.y, p.w, 14, 7);
    ctx.fill();
  }

  // Tee peg.
  ctx.fillStyle = COLORS.cream;
  roundRect(ctx, hole.tee.x - 3, hole.tee.y + BALL_RADIUS - 2, 6, 10, 2);
  ctx.fill();

  if (aim) {
    aim.dots.forEach((dot, i) => {
      ctx.fillStyle = `rgba(255,247,232,${Math.max(0.15, 0.95 - i * (0.8 / aim.dots.length))})`;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
    // The rubber band from the ball to the finger.
    ctx.strokeStyle = "rgba(255,194,26,0.9)";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x + aim.pull.x, ball.y + aim.pull.y);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (ready) {
    const pulse = (Math.sin(time / 260) + 1) / 2;
    ctx.strokeStyle = `rgba(255,194,26,${0.35 + pulse * 0.5})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS + 10 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawBall(ctx, ball);
}
