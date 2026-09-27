import { BALL_RADIUS, CUP, WORLD, type Hole, type Point, type Rect, type Windmill } from "./holes";
import { RAIL } from "./world";

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
  block: "#2F6BEA",
  blockLip: "#1C47A8",
  sand: "#F2D48A",
  sandDark: "#D9B25E",
  sail: "#FF8A1F",
  sailLip: "#B8600F",
};

export type Frame = {
  hole: Hole;
  ball: Point;
  platformX: number | null;
  /** The windmill's current angle, if the hole has one. */
  windmillAngle: number | null;
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

function drawCupAndFlag(ctx: CanvasRenderingContext2D, cup: Point, time: number, roofAbove: number | null) {
  ctx.fillStyle = COLORS.cup;
  roundRect(ctx, cup.x - CUP.width / 2 + 2, cup.y + 2, CUP.width - 4, CUP.depth - 2, 6);
  ctx.fill();

  // Under a low roof the pole is shorter, so the flag still shows beneath it.
  const top = Math.max(cup.y - 110, (roofAbove ?? -Infinity) + 10);
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

/** A glossy plastic block: walls to go over, roofs to go under. */
function drawBlock(ctx: CanvasRenderingContext2D, r: Rect) {
  ctx.fillStyle = COLORS.blockLip;
  roundRect(ctx, r.x, r.y + 4, r.w, r.h, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.block;
  roundRect(ctx, r.x, r.y, r.w, r.h - 2, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, r.x + 5, r.y + 4, r.w - 10, Math.min(8, r.h / 4), 4);
  ctx.fill();
}

/** A sand bunker: the pit filled almost to the brim, speckled. */
function drawSand(ctx: CanvasRenderingContext2D, zone: Rect) {
  const top = zone.y + zone.h - 20;
  ctx.fillStyle = COLORS.sand;
  ctx.beginPath();
  ctx.moveTo(zone.x, zone.y + zone.h + 4);
  ctx.lineTo(zone.x, top + 6);
  ctx.quadraticCurveTo(zone.x + zone.w / 2, top - 6, zone.x + zone.w, top + 6);
  ctx.lineTo(zone.x + zone.w, zone.y + zone.h + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.sandDark;
  for (let i = 0; i < zone.w / 9; i++) {
    const x = zone.x + 6 + ((i * 37) % (zone.w - 12));
    const y = top + 8 + ((i * 13) % 12);
    ctx.fillRect(x, y, 3, 3);
  }
}

/** Wind: a pale band with streaks drifting the way it blows, plus an arrow. */
function drawWind(ctx: CanvasRenderingContext2D, zone: Rect & { push: Point }, time: number) {
  const top = Math.max(zone.y, 0);
  const bottom = Math.min(zone.y + zone.h, WORLD.height);
  ctx.fillStyle = "rgba(143,178,255,0.10)";
  ctx.fillRect(zone.x, top, zone.w, bottom - top);
  const dir = Math.sign(zone.push.x) || 1;
  ctx.strokeStyle = "rgba(220,232,255,0.45)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let row = 0, y = top + 30; y < bottom - 20; row++, y += 46) {
    const drift = ((time / 6) * dir + row * 57) % zone.w;
    for (let k = 0; k < 3; k++) {
      const x = zone.x + ((drift + (k * zone.w) / 3 + zone.w) % zone.w);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 34 * dir, y);
      ctx.stroke();
    }
  }
  // A big arrow near the top, so it reads at a glance.
  const ax = zone.x + zone.w / 2;
  const ay = top + 16;
  ctx.fillStyle = "rgba(220,232,255,0.8)";
  ctx.beginPath();
  ctx.moveTo(ax - 30 * dir, ay - 5);
  ctx.lineTo(ax + 10 * dir, ay - 5);
  ctx.lineTo(ax + 10 * dir, ay - 13);
  ctx.lineTo(ax + 32 * dir, ay);
  ctx.lineTo(ax + 10 * dir, ay + 13);
  ctx.lineTo(ax + 10 * dir, ay + 5);
  ctx.lineTo(ax - 30 * dir, ay + 5);
  ctx.closePath();
  ctx.fill();
}

/**
 * The windmill's tower. Only its upper part is solid (that's what stops a
 * lob); it's drawn down to the ground with an arched doorway at the foot,
 * the way through that the turning sails guard, like a mini-golf windmill.
 */
function drawTower(ctx: CanvasRenderingContext2D, tower: Rect, ground: number) {
  const top = Math.max(tower.y, -20);
  const flare = 22;
  ctx.fillStyle = "#E9DFC9";
  ctx.beginPath();
  ctx.moveTo(tower.x + 10, top);
  ctx.lineTo(tower.x + tower.w - 10, top);
  ctx.lineTo(tower.x + tower.w + flare, ground);
  ctx.lineTo(tower.x - flare, ground);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(tower.x + 16, top, 14, ground - top);
  // Two little windows, and the doorway the ball rolls through.
  ctx.fillStyle = "#8FB2FF";
  for (const y of [tower.y + tower.h - 150, tower.y + tower.h - 70]) {
    if (y < top) continue;
    roundRect(ctx, tower.x + tower.w / 2 - 12, y, 24, 30, 12);
    ctx.fill();
  }
  const door = { w: 64, h: 70 };
  ctx.fillStyle = "#0B1430";
  ctx.beginPath();
  ctx.moveTo(tower.x + tower.w / 2 - door.w / 2, ground);
  ctx.lineTo(tower.x + tower.w / 2 - door.w / 2, ground - door.h + door.w / 2);
  ctx.arc(tower.x + tower.w / 2, ground - door.h + door.w / 2, door.w / 2, Math.PI, 0);
  ctx.lineTo(tower.x + tower.w / 2 + door.w / 2, ground);
  ctx.closePath();
  ctx.fill();
}

function drawWindmill(ctx: CanvasRenderingContext2D, mill: Windmill, angle: number) {
  for (let i = 0; i < mill.blades; i++) {
    const a = angle + (i * Math.PI * 2) / mill.blades;
    ctx.save();
    ctx.translate(mill.x, mill.y);
    ctx.rotate(a);
    // A sail: a plastic lattice paddle on a spar.
    ctx.fillStyle = COLORS.sailLip;
    roundRect(ctx, 14, -9, mill.arm - 14, 18, 7);
    ctx.fill();
    ctx.fillStyle = COLORS.sail;
    roundRect(ctx, 14, -8, mill.arm - 16, 15, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    for (let x = 34; x < mill.arm - 8; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, -6);
      ctx.lineTo(x, 6);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = COLORS.flag;
  ctx.beginPath();
  ctx.arc(mill.x, mill.y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.arc(mill.x - 5, mill.y - 5, 5, 0, Math.PI * 2);
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

/** The rails at the course's edges, which the ball bounces off. */
function drawRails(ctx: CanvasRenderingContext2D) {
  for (const x of [0, WORLD.width - RAIL]) {
    ctx.fillStyle = "rgba(255,247,232,0.16)";
    ctx.fillRect(x, 0, RAIL, WORLD.height);
    ctx.fillStyle = "rgba(255,247,232,0.35)";
    ctx.fillRect(x + (x === 0 ? RAIL - 2 : 0), 0, 2, WORLD.height);
  }
}

export function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame) {
  const { hole, ball, platformX, windmillAngle, aim, ready, time } = frame;
  ctx.clearRect(-200, -200, WORLD.width + 400, WORLD.height + 400);

  drawRails(ctx);
  for (const zone of hole.wind ?? []) drawWind(ctx, zone, time);
  // With a windmill, the block above its hub is its tower, drawn behind the sails.
  const tower = hole.windmill ? (hole.walls ?? []).find((w) => w.y < 0 && hole.windmill!.x > w.x && hole.windmill!.x < w.x + w.w) : undefined;
  if (tower) drawTower(ctx, tower, hole.tee.y + BALL_RADIUS);

  for (const water of hole.water ?? []) {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(water.x, water.y, water.w, water.h + 60);
    ctx.fillStyle = COLORS.waterTop;
    for (let x = water.x; x < water.x + water.w; x += 24) {
      ctx.fillRect(x + ((time / 30) % 24), water.y + 4 + Math.sin((x + time / 6) / 20) * 2, 12, 3);
    }
  }

  for (const island of hole.islands) drawIsland(ctx, island);
  for (const zone of hole.sand ?? []) drawSand(ctx, zone);
  const roof = (hole.walls ?? []).filter((w) => w.x < hole.cup.x && w.x + w.w > hole.cup.x && w.y + w.h < hole.cup.y);
  drawCupAndFlag(ctx, hole.cup, time, roof.length ? Math.max(...roof.map((w) => w.y + w.h)) : null);
  for (const wall of hole.walls ?? []) if (wall !== tower) drawBlock(ctx, wall);
  if (hole.windmill && windmillAngle !== null) drawWindmill(ctx, hole.windmill, windmillAngle);

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
