import * as THREE from "three";

/**
 * Textures painted in code on a 2D canvas: no image files to download, and
 * they stay sharp because they're drawn at the size they're shown.
 */

const PX_PER_CELL = 256;

/** Warm wood with a soft grain, and a grid of peg holes every quarter cell. */
export function boardTexture(widthCells: number, heightCells: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(widthCells * PX_PER_CELL);
  canvas.height = Math.round(heightCells * PX_PER_CELL);
  const ctx = canvas.getContext("2d")!;

  const base = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  base.addColorStop(0, "#E2A566");
  base.addColorStop(1, "#C98446");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grain: long wavy strokes, a little darker and a little lighter than the wood.
  for (let i = 0; i < 90; i++) {
    const y0 = (i / 90) * canvas.height;
    ctx.strokeStyle = i % 3 === 0 ? "rgba(120,60,20,0.28)" : "rgba(255,225,180,0.2)";
    ctx.lineWidth = 2 + (i % 4);
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 16) {
      const y = y0 + Math.sin(x / 190 + i * 1.7) * 7 + Math.sin(x / 47 + i) * 2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const step = PX_PER_CELL / 4;
  for (let x = step / 2; x < canvas.width; x += step) {
    for (let y = step / 2; y < canvas.height; y += step) {
      ctx.fillStyle = "rgba(255,240,215,0.35)";
      ctx.beginPath();
      ctx.arc(x, y + 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(90,45,15,0.55)";
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** The tabletop: darker planks running away from the player. */
export function tableTexture(widthCells: number, depthCells: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(widthCells * 64);
  canvas.height = Math.round(depthCells * 64);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#9A5F33";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const plank = 96;
  for (let x = 0; x < canvas.width; x += plank) {
    ctx.fillStyle = (x / plank) % 2 ? "rgba(255,210,160,0.08)" : "rgba(60,25,5,0.1)";
    ctx.fillRect(x, 0, plank, canvas.height);
    ctx.fillStyle = "rgba(50,20,5,0.45)";
    ctx.fillRect(x, 0, 3, canvas.height);
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = "rgba(70,30,8,0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const gx = x + 12 + i * 14;
      for (let y = 0; y <= canvas.height; y += 12) ctx.lineTo(gx + Math.sin(y / 40 + i + x) * 3, y);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A dashed, glowing rounded square with a "+": build here. */
export function buildCellTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(255,247,232,0.35)";
  ctx.beginPath();
  ctx.roundRect(10, 10, size - 20, size - 20, 36);
  ctx.fill();
  ctx.setLineDash([26, 16]);
  ctx.lineWidth = 9;
  ctx.strokeStyle = "#FFF7E8";
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = "round";
  ctx.lineWidth = 16;
  ctx.strokeStyle = "rgba(255,247,232,0.95)";
  ctx.beginPath();
  ctx.moveTo(size / 2 - 34, size / 2);
  ctx.lineTo(size / 2 + 34, size / 2);
  ctx.moveTo(size / 2, size / 2 - 34);
  ctx.lineTo(size / 2, size / 2 + 34);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
