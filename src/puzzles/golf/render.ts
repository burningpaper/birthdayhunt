import { BALL_RADIUS, CUP, WORLD, type Hole, type Point, type Rect, type Windmill } from "./holes";
import { RAIL } from "./world";

/**
 * Drawing one frame of Flick Golf onto a canvas, in world units (the caller
 * sets up the scale). The course is built from toy bricks: a studded
 * baseplate for the sky, green bricks for the grass with studs along every
 * flat top, red bricks for walls, clear blue tiles for water, tan tiles for
 * sand, plates for the trampoline, bridge and windmill sails.
 *
 * The parts that never move (baseplate, ground, walls, tower) are drawn
 * once per hole and size into offscreen canvases; each frame draws those
 * two images, then only what moves on top.
 */

/** One stud's pitch, and one brick's height, in world units (the ball is about a stud across). */
const PITCH = 20;
const BRICK_H = 24;
/** The height of the ground most holes are built on: brick rows line up with it. */
const GROUND = 440;

const BRICK = {
  grass: { face: "#2DB35C", light: "#6BDB8F", dark: "#1B7F3E" },
  wall: { face: "#E3342B", light: "#FF7A6E", dark: "#9E1F19" },
  white: { face: "#F4EFE4", light: "#FFFFFF", dark: "#BDB3A2" },
  grey: { face: "#9AA3B2", light: "#C9D0DB", dark: "#5F6878" },
  sand: { face: "#E6CD8E", light: "#F6E6BC", dark: "#B89A55" },
  pad: { face: "#F0508F", light: "#FF8FB8", dark: "#A8325F" },
  plate: { face: "#FF8A1F", light: "#FFB870", dark: "#B8600F" },
};
type BrickColor = (typeof BRICK)[keyof typeof BRICK];

const SKY = { face: "#6FB7F2", stud: "#8FCBFA", studShadow: "#4F95D6" };
const COLORS = { cup: "#0B1430", flag: "#E3342B", water: "rgba(64,150,245,0.82)", waterTop: "rgba(214,238,255,0.9)", cream: "#FFF7E8", ink: "#14213F" };

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

/** A stud seen side-on: a short rounded cylinder with a lit top edge, standing on `y`. */
function stud(ctx: CanvasRenderingContext2D, cx: number, y: number, color: BrickColor) {
  ctx.fillStyle = color.dark;
  roundRect(ctx, cx - 6, y - 6, 12, 7, 2);
  ctx.fill();
  ctx.fillStyle = color.face;
  roundRect(ctx, cx - 6, y - 6, 12, 5, 2);
  ctx.fill();
  ctx.fillStyle = color.light;
  ctx.fillRect(cx - 4, y - 5.5, 8, 1.5);
}

/** Studs along a flat top from x0 to x1, one per pitch, snapped to the world's stud grid. */
function studsAlong(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, color: BrickColor) {
  for (let x = Math.ceil(x0 / PITCH) * PITCH; x + PITCH <= x1 + 0.01; x += PITCH) stud(ctx, x + PITCH / 2, y, color);
}

/**
 * Brick courses inside whatever is clipped: rows BRICK_H high (lined up with
 * the ground), each brick four studs long, alternate rows offset by two, a lit
 * top edge and a shadowed bottom edge on every row.
 */
function brickCourses(ctx: CanvasRenderingContext2D, area: Rect, color: BrickColor) {
  const first = GROUND + Math.floor((area.y - GROUND) / BRICK_H) * BRICK_H;
  for (let y = first, row = 0; y < area.y + area.h; y += BRICK_H, row++) {
    ctx.fillStyle = color.light;
    ctx.fillRect(area.x, y, area.w, 2);
    ctx.fillStyle = color.dark;
    ctx.fillRect(area.x, y + BRICK_H - 3, area.w, 3);
    const offset = (Math.floor((y - GROUND) / BRICK_H) % 2) * PITCH * 2;
    for (let x = Math.floor(area.x / (PITCH * 4)) * PITCH * 4 + offset; x < area.x + area.w; x += PITCH * 4) {
      ctx.fillRect(x, y + 2, 2, BRICK_H - 5);
    }
  }
}

// ---------- The static layers ----------

/** The sky: a studded baseplate. */
function drawBaseplate(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = SKY.face;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (let x = PITCH / 2; x < WORLD.width; x += PITCH * 2) {
    for (let y = PITCH / 2; y < WORLD.height; y += PITCH * 2) {
      ctx.fillStyle = SKY.studShadow;
      ctx.beginPath();
      ctx.arc(x + 1, y + 1.5, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = SKY.stud;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** A strip of ground: green bricks, studs along each flat top; sloped stretches are smooth slope bricks. */
function drawIsland(ctx: CanvasRenderingContext2D, points: Point[], cupX: number) {
  const bottom = WORLD.height + 120;
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, bottom);
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.lineTo(points[points.length - 1].x, bottom);
    ctx.closePath();
  };
  outline();
  ctx.fillStyle = BRICK.grass.face;
  ctx.fill();
  ctx.save();
  outline();
  ctx.clip();
  const xs = points.map((p) => p.x);
  const top = Math.min(...points.map((p) => p.y));
  brickCourses(ctx, { x: Math.min(...xs), y: top, w: Math.max(...xs) - Math.min(...xs), h: bottom - top }, BRICK.grass);
  ctx.restore();

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a.y === b.y && b.x > a.x) {
      // A flat top: studs, but none over the cup's mouth.
      const inCup = cupX > a.x && cupX < b.x && Math.abs(b.x - a.x - CUP.width) < 1;
      if (!inCup) studsAlong(ctx, a.x, b.x, a.y, BRICK.grass);
    } else if (a.x !== b.x) {
      // A slope brick: smooth, with a glossy face along the incline.
      ctx.strokeStyle = BRICK.grass.light;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + 2);
      ctx.lineTo(b.x, b.y + 2);
      ctx.stroke();
    }
  }
}

function drawCupHole(ctx: CanvasRenderingContext2D, cup: Point) {
  ctx.fillStyle = COLORS.cup;
  roundRect(ctx, cup.x - CUP.width / 2 + 2, cup.y + 1, CUP.width - 4, CUP.depth - 1, 4);
  ctx.fill();
}

/** A wall (or roof, or hanging curtain) built from red bricks, studs on top if its top is on screen. */
function drawBrickWall(ctx: CanvasRenderingContext2D, r: Rect) {
  const top = Math.max(r.y, -BRICK_H);
  ctx.fillStyle = BRICK.wall.face;
  ctx.fillRect(r.x, top, r.w, r.y + r.h - top);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, top, r.w, r.y + r.h - top);
  ctx.clip();
  brickCourses(ctx, { x: r.x, y: top, w: r.w, h: r.y + r.h - top }, BRICK.wall);
  ctx.restore();
  // Its underside, and its ends, a shade darker: it's a solid stack.
  ctx.fillStyle = BRICK.wall.dark;
  ctx.fillRect(r.x, r.y + r.h - 3, r.w, 3);
  if (r.y >= 0) studsAlong(ctx, r.x, r.x + r.w, r.y, BRICK.wall);
}

/** Water: clear blue tiles filling the pond. */
function drawWaterBase(ctx: CanvasRenderingContext2D, water: Rect) {
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(water.x, water.y, water.w, water.h + 60);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let x = Math.ceil(water.x / (PITCH * 2)) * PITCH * 2; x < water.x + water.w; x += PITCH * 2) ctx.fillRect(x, water.y, 2, water.h + 60);
}

/** Sand: a bunker filled with flat tan tiles (tiles have no studs). */
function drawSand(ctx: CanvasRenderingContext2D, zone: Rect) {
  const top = zone.y + zone.h - 20;
  ctx.fillStyle = BRICK.sand.face;
  ctx.fillRect(zone.x, top, zone.w, 24);
  ctx.fillStyle = BRICK.sand.light;
  ctx.fillRect(zone.x, top, zone.w, 2);
  ctx.fillStyle = BRICK.sand.dark;
  for (let x = Math.ceil(zone.x / (PITCH * 2)) * PITCH * 2; x < zone.x + zone.w; x += PITCH * 2) ctx.fillRect(x, top + 2, 2, 18);
  ctx.fillRect(zone.x, top + 20, zone.w, 3);
}

/**
 * The windmill's tower, from white bricks. Only its upper part is solid
 * (that's what stops a lob); it's drawn down to the ground with an arched
 * doorway at the foot, the way through that the turning sails guard.
 */
function drawTower(ctx: CanvasRenderingContext2D, tower: Rect, ground: number) {
  const top = Math.max(tower.y, -BRICK_H);
  const body = { x: tower.x - 10, y: top, w: tower.w + 20, h: ground - top };
  ctx.fillStyle = BRICK.white.face;
  ctx.fillRect(body.x, body.y, body.w, body.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(body.x, body.y, body.w, body.h);
  ctx.clip();
  brickCourses(ctx, body, BRICK.white);
  ctx.restore();
  // Clear blue windows (1 x 2 bricks) and the doorway the ball rolls through.
  for (const y of [tower.y + tower.h - 150, tower.y + tower.h - 70]) {
    if (y < top) continue;
    ctx.fillStyle = "rgba(111,183,242,0.9)";
    roundRect(ctx, tower.x + tower.w / 2 - 12, y, 24, BRICK_H * 1.25, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(tower.x + tower.w / 2 - 8, y + 4, 4, BRICK_H - 6);
  }
  const door = { w: 64, h: 72 };
  const cx = tower.x + tower.w / 2;
  ctx.fillStyle = COLORS.cup;
  ctx.beginPath();
  ctx.moveTo(cx - door.w / 2, ground);
  ctx.lineTo(cx - door.w / 2, ground - door.h + door.w / 2);
  ctx.arc(cx, ground - door.h + door.w / 2, door.w / 2, Math.PI, 0);
  ctx.lineTo(cx + door.w / 2, ground);
  ctx.closePath();
  ctx.fill();
}

/** The rails at the course's edges: grey beams with a row of holes. */
function drawRails(ctx: CanvasRenderingContext2D) {
  for (const x of [0, WORLD.width - RAIL]) {
    ctx.fillStyle = BRICK.grey.face;
    ctx.fillRect(x, 0, RAIL, WORLD.height);
    ctx.fillStyle = BRICK.grey.dark;
    for (let y = PITCH / 2; y < WORLD.height; y += PITCH) {
      ctx.beginPath();
      ctx.arc(x + RAIL / 2, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function towerOf(hole: Hole): Rect | undefined {
  // With a windmill, the block above its hub is its tower.
  return hole.windmill ? (hole.walls ?? []).find((w) => w.y < 0 && hole.windmill!.x > w.x && hole.windmill!.x < w.x + w.w) : undefined;
}

function drawFront(ctx: CanvasRenderingContext2D, hole: Hole) {
  const tower = towerOf(hole);
  if (tower) drawTower(ctx, tower, hole.tee.y + BALL_RADIUS);
  for (const water of hole.water ?? []) drawWaterBase(ctx, water);
  for (const island of hole.islands) drawIsland(ctx, island, hole.cup.x);
  for (const zone of hole.sand ?? []) drawSand(ctx, zone);
  drawCupHole(ctx, hole.cup);
  for (const wall of hole.walls ?? []) if (wall !== tower) drawBrickWall(ctx, wall);
  drawRails(ctx);
}

/** Offscreen copies of the static layers, per hole and drawing scale. Kept small: a station plays one course. */
const layers = new Map<string, HTMLCanvasElement>();

function layer(key: string, scale: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const id = `${key}@${scale.toFixed(3)}`;
  const cached = layers.get(id);
  if (cached) return cached;
  if (layers.size > 30) layers.clear();
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(WORLD.width * scale);
  canvas.height = Math.ceil(WORLD.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  paint(ctx);
  layers.set(id, canvas);
  return canvas;
}

// ---------- What moves ----------

/** Wind: a pale band with streaks drifting the way it blows, plus an arrow. */
function drawWind(ctx: CanvasRenderingContext2D, zone: Rect & { push: Point }, time: number) {
  const top = Math.max(zone.y, 0);
  const bottom = Math.min(zone.y + zone.h, WORLD.height);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(zone.x, top, zone.w, bottom - top);
  const dir = Math.sign(zone.push.x) || 1;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
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
  ctx.fillStyle = "rgba(255,255,255,0.95)";
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

function drawWaterShimmer(ctx: CanvasRenderingContext2D, water: Rect, time: number) {
  ctx.fillStyle = COLORS.waterTop;
  for (let x = water.x; x < water.x + water.w - 12; x += 24) {
    ctx.fillRect(x + ((time / 30) % 12), water.y + 3 + Math.sin((x + time / 6) / 20) * 1.5, 10, 2.5);
  }
}

/** The flag: a grey pole of stacked bar segments, and a waving red flag. */
function drawFlag(ctx: CanvasRenderingContext2D, cup: Point, time: number, roofAbove: number | null) {
  // Under a low roof the pole is shorter, so the flag still shows beneath it.
  const top = Math.max(cup.y - 110, (roofAbove ?? -Infinity) + 10);
  ctx.fillStyle = BRICK.grey.dark;
  ctx.fillRect(cup.x - 3, top, 7, cup.y + 4 - top);
  ctx.fillStyle = BRICK.grey.face;
  ctx.fillRect(cup.x - 3, top, 5, cup.y + 4 - top);
  ctx.fillStyle = BRICK.grey.dark;
  for (let y = top + BRICK_H; y < cup.y; y += BRICK_H) ctx.fillRect(cup.x - 4, y, 9, 2);
  const wave = Math.sin(time / 240) * 6;
  ctx.fillStyle = COLORS.flag;
  ctx.beginPath();
  ctx.moveTo(cup.x + 2, top);
  ctx.quadraticCurveTo(cup.x + 30, top + 8 + wave, cup.x + 58, top + 18);
  ctx.quadraticCurveTo(cup.x + 30, top + 26 - wave, cup.x + 2, top + 38);
  ctx.closePath();
  ctx.fill();
}

/** A plate (a thin brick) with studs along its top: trampolines, the bridge, windmill sails. */
function drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: BrickColor, h = 12) {
  ctx.fillStyle = color.dark;
  roundRect(ctx, x, y, w, h, 2);
  ctx.fill();
  ctx.fillStyle = color.face;
  roundRect(ctx, x, y, w, h - 3, 2);
  ctx.fill();
  ctx.fillStyle = color.light;
  ctx.fillRect(x + 2, y + 1, w - 4, 2);
  for (let sx = x + PITCH / 2; sx < x + w; sx += PITCH) stud(ctx, sx, y, color);
}

function drawWindmill(ctx: CanvasRenderingContext2D, mill: Windmill, angle: number) {
  for (let i = 0; i < mill.blades; i++) {
    const a = angle + (i * Math.PI * 2) / mill.blades;
    ctx.save();
    ctx.translate(mill.x, mill.y);
    ctx.rotate(a);
    drawPlate(ctx, 16, -8, mill.arm - 16, BRICK.grey, 16);
    ctx.restore();
  }
  // The hub: a round red brick with a stud in the middle.
  ctx.fillStyle = BRICK.wall.dark;
  ctx.beginPath();
  ctx.arc(mill.x, mill.y + 2, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BRICK.wall.face;
  ctx.beginPath();
  ctx.arc(mill.x, mill.y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BRICK.wall.light;
  ctx.beginPath();
  ctx.arc(mill.x, mill.y, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Point) {
  ctx.fillStyle = "rgba(8,14,36,0.3)";
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
  const { hole, ball, platformX, windmillAngle, aim, ready, time } = frame;
  const scale = ctx.getTransform().a;
  ctx.clearRect(-200, -200, WORLD.width + 400, WORLD.height + 400);

  ctx.drawImage(layer("baseplate", scale, drawBaseplate), 0, 0, WORLD.width, WORLD.height);
  for (const zone of hole.wind ?? []) drawWind(ctx, zone, time);
  ctx.drawImage(layer(hole.name, scale, (c) => drawFront(c, hole)), 0, 0, WORLD.width, WORLD.height);

  for (const water of hole.water ?? []) drawWaterShimmer(ctx, water, time);
  const roof = (hole.walls ?? []).filter((w) => w.x < hole.cup.x && w.x + w.w > hole.cup.x && w.y + w.h < hole.cup.y);
  drawFlag(ctx, hole.cup, time, roof.length ? Math.max(...roof.map((w) => w.y + w.h)) : null);
  if (hole.windmill && windmillAngle !== null) drawWindmill(ctx, hole.windmill, windmillAngle);
  for (const pad of hole.bouncePads ?? []) drawPlate(ctx, pad.x, pad.y - 12, pad.w, BRICK.pad, 14);
  if (platformX !== null && hole.movingPlatform) drawPlate(ctx, platformX, hole.movingPlatform.y, hole.movingPlatform.w, BRICK.plate, 16);

  // The tee: a little white round plate.
  ctx.fillStyle = BRICK.white.dark;
  roundRect(ctx, hole.tee.x - 7, hole.tee.y + BALL_RADIUS - 3, 14, 5, 2);
  ctx.fill();
  ctx.fillStyle = BRICK.white.face;
  roundRect(ctx, hole.tee.x - 7, hole.tee.y + BALL_RADIUS - 4, 14, 3, 2);
  ctx.fill();

  if (aim) {
    aim.dots.forEach((dot, i) => {
      const alpha = Math.max(0.2, 1 - i * (0.8 / aim.dots.length));
      ctx.fillStyle = `rgba(20,33,63,${alpha * 0.55})`;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
    // The rubber band from the ball to the finger.
    ctx.strokeStyle = "rgba(255,194,26,0.95)";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x + aim.pull.x, ball.y + aim.pull.y);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (ready) {
    const pulse = (Math.sin(time / 260) + 1) / 2;
    ctx.strokeStyle = `rgba(255,194,26,${0.45 + pulse * 0.5})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS + 10 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawBall(ctx, ball);
}
