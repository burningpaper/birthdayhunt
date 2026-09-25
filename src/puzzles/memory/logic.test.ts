import { describe, expect, it } from "vitest";
import { seededRng } from "../random";
import { BUILT_IN_FACES, chooseFaces, dealDeck, gridFor, initialState, isFaceUp, isSolved, reduce, type MemoryState } from "./logic";

const flip = (state: MemoryState, index: number) => reduce(state, { type: "flip", index });

describe("faces and deck", () => {
  it("has enough built-in faces for the biggest board", () => {
    expect(BUILT_IN_FACES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(BUILT_IN_FACES.map((f) => f.id)).size).toBe(BUILT_IN_FACES.length);
  });

  it("uses the parent's photos first, then fills with built-ins", () => {
    const faces = chooseFaces(6, ["/a.jpg", "/b.jpg"], seededRng(1));
    expect(faces).toHaveLength(6);
    expect(faces.slice(0, 2).map((f) => f.kind)).toEqual(["photo", "photo"]);
    expect(faces.slice(2).every((f) => f.kind === "icon")).toBe(true);
  });

  it("never uses more photos than pairs", () => {
    const urls = Array.from({ length: 8 }, (_, i) => `/${i}.jpg`);
    expect(chooseFaces(6, urls, seededRng(1)).every((f) => f.kind === "photo")).toBe(true);
  });

  it("deals every face exactly twice", () => {
    const faces = chooseFaces(10, undefined, seededRng(2));
    const deck = dealDeck(faces, seededRng(3));
    expect(deck).toHaveLength(20);
    for (const face of faces) expect(deck.filter((id) => id === face.id)).toHaveLength(2);
  });

  it("lays every supported size out in full rows", () => {
    for (const cards of [12, 16, 20, 24]) {
      const { cols, rows } = gridFor(cards);
      expect(cols * rows).toBe(cards);
      expect(cols).toBeGreaterThanOrEqual(rows);
    }
  });
});

describe("reduce", () => {
  const deck = ["a", "b", "a", "b"];

  it("turns up one card, then a matching second keeps both up", () => {
    let s = flip(initialState(deck), 0);
    expect(s.open).toEqual([0]);
    s = flip(s, 2);
    expect(s.matched).toEqual([true, false, true, false]);
    expect(s.open).toEqual([]);
    expect(s.locked).toBe(false);
  });

  it("locks on a mismatch until the cards are hidden again", () => {
    let s = flip(flip(initialState(deck), 0), 1);
    expect(s.open).toEqual([0, 1]);
    expect(s.locked).toBe(true);
    expect(flip(s, 2)).toBe(s); // taps are ignored while locked
    s = reduce(s, { type: "hide" });
    expect(s.open).toEqual([]);
    expect(s.locked).toBe(false);
  });

  it("ignores taps on the open card and on matched cards", () => {
    const one = flip(initialState(deck), 0);
    expect(flip(one, 0)).toBe(one);
    const matched = flip(one, 2);
    expect(flip(matched, 0)).toBe(matched);
  });

  it("is solved when every pair is matched", () => {
    let s = initialState(deck);
    for (const i of [0, 2, 1, 3]) s = flip(s, i);
    expect(isSolved(s)).toBe(true);
    expect([0, 1, 2, 3].every((i) => isFaceUp(s, i))).toBe(true);
  });
});
