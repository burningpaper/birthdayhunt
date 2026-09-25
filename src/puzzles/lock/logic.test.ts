import { describe, expect, it } from "vitest";
import { checkDials, dialOfWheel, dialValues, hintDial, hintText, spin, wheelCount } from "./logic";

describe("wheels and dials", () => {
  it("gives a single 0-99 dial two wheels (tens and ones)", () => {
    expect(wheelCount(1)).toBe(2);
    expect(dialValues(1, [4, 7])).toEqual([47]);
    expect(dialOfWheel(1, 0)).toBe(0);
    expect(dialOfWheel(1, 1)).toBe(0);
  });

  it("gives 2 or 3 dials one wheel each", () => {
    expect(wheelCount(3)).toBe(3);
    expect(dialValues(3, [1, 2, 3])).toEqual([1, 2, 3]);
    expect(dialOfWheel(3, 2)).toBe(2);
  });

  it("wraps like a real combination lock", () => {
    expect(spin(9, 1)).toBe(0);
    expect(spin(0, -1)).toBe(9);
    expect(spin(4, 1)).toBe(5);
  });
});

describe("checking", () => {
  it("marks each dial right or wrong", () => {
    expect(checkDials([3, 5, 2], [3, 4, 2])).toEqual([true, false, true]);
  });
});

describe("hints", () => {
  it("points at a wrong dial, rotating on repeat hints", () => {
    const correct = [true, false, false];
    expect(hintDial(correct, 1)).toBe(1);
    expect(hintDial(correct, 2)).toBe(2);
    expect(hintDial(correct, 3)).toBe(1);
  });

  it("has nothing to say when every dial is right", () => {
    expect(hintDial([true, true], 1)).toBeNull();
  });

  it("gives direction without the answer", () => {
    expect(hintText(1, 3, 7, 3)).toBe("Dial 2 is more than 3!");
    expect(hintText(0, 8, 2, 3)).toBe("Dial 1 is less than 8!");
    expect(hintText(0, 30, 47, 1)).toBe("The number is more than 30!");
  });
});
