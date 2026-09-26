/**
 * The jigsaw "mystery close-up" (a region of the clue photo), and the
 * geometry for cutting the puzzle from it and zooming out afterwards.
 *
 * A crop is stored as fractions of the photo: x and y of its top-left
 * corner, and its size. It always keeps the photo's own shape (size is the
 * same fraction of the width and the height), so the zoom-out is a clean
 * pull-back with the board never changing shape.
 */

export type Crop = { x: number; y: number; size: number };
type Rect = { x: number; y: number; w: number; h: number };

export const MIN_CROP = 0.2;
export const DEFAULT_CROP: Crop = { x: 0.3, y: 0.3, size: 0.4 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function clampCrop(crop: Crop): Crop {
  const size = clamp(crop.size, MIN_CROP, 1);
  return { x: clamp(crop.x, 0, 1 - size), y: clamp(crop.y, 0, 1 - size), size };
}

/**
 * Where to draw the whole photo so that the close-up exactly fills the
 * board. (With no close-up, the photo simply is the board.)
 */
export function fullImageRect(board: Rect, crop: Crop | undefined): Rect {
  if (!crop) return board;
  const w = board.w / crop.size;
  const h = board.h / crop.size;
  return { x: board.x - crop.x * w, y: board.y - crop.y * h, w, h };
}

export type ZoomTransform = { scale: number; translateX: number; translateY: number };

/**
 * The start of the zoom-out: a transform (applied about the origin) that
 * takes the whole photo drawn at board size and blows it up so only the
 * close-up shows. Animating it back to the identity is the reveal.
 */
export function zoomOutFrom(board: Rect, crop: Crop | undefined): ZoomTransform {
  if (!crop) return { scale: 1, translateX: 0, translateY: 0 };
  const scale = 1 / crop.size;
  const target = fullImageRect(board, crop);
  return { scale, translateX: target.x - scale * board.x, translateY: target.y - scale * board.y };
}
