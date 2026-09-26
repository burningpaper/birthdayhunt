import { describe, expect, it } from "vitest";
import { DEFAULT_CROP, clampCrop, fullImageRect, zoomOutFrom } from "./crop";

const board = { x: 100, y: 50, w: 400, h: 300 };

describe("clampCrop", () => {
  it("keeps the close-up inside the photo", () => {
    expect(clampCrop({ x: 0.9, y: -0.2, size: 0.4 })).toEqual({ x: 0.6, y: 0, size: 0.4 });
  });

  it("limits how tight and how loose the close-up can be", () => {
    expect(clampCrop({ x: 0, y: 0, size: 0.05 }).size).toBe(0.2);
    expect(clampCrop({ x: 0.3, y: 0.3, size: 1.5 })).toEqual({ x: 0, y: 0, size: 1 });
  });

  it("starts a new close-up centred", () => {
    expect(DEFAULT_CROP.x + DEFAULT_CROP.size / 2).toBeCloseTo(0.5);
    expect(DEFAULT_CROP.y + DEFAULT_CROP.size / 2).toBeCloseTo(0.5);
  });
});

describe("fullImageRect", () => {
  it("is just the board when there's no close-up", () => {
    expect(fullImageRect(board, undefined)).toEqual(board);
  });

  it("places the whole photo so the close-up lands exactly on the board", () => {
    const rect = fullImageRect(board, { x: 0.25, y: 0.5, size: 0.5 });
    expect(rect.w).toBe(800);
    expect(rect.h).toBe(600);
    // The close-up's top-left corner (25% across, 50% down) sits on the board's corner.
    expect(rect.x + 0.25 * rect.w).toBeCloseTo(board.x);
    expect(rect.y + 0.5 * rect.h).toBeCloseTo(board.y);
  });
});

describe("zoomOutFrom", () => {
  it("maps the whole photo (drawn on the board) onto the close-up view", () => {
    const crop = { x: 0.25, y: 0.5, size: 0.5 };
    const t = zoomOutFrom(board, crop);
    expect(t.scale).toBe(2);
    // A point in the photo drawn at board size, moved by the start transform,
    // lands where the close-up view draws it.
    const photoX = 0.5; // halfway across the photo
    const drawnAtBoard = board.x + photoX * board.w;
    const inCloseUp = fullImageRect(board, crop).x + photoX * fullImageRect(board, crop).w;
    expect(t.scale * drawnAtBoard + t.translateX).toBeCloseTo(inCloseUp);
  });

  it("is the identity when there's no close-up", () => {
    expect(zoomOutFrom(board, undefined)).toEqual({ scale: 1, translateX: 0, translateY: 0 });
  });
});
