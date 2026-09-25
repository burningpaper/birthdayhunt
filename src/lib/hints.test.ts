import { describe, expect, it } from "vitest";
import { IDLE_MS_FOR_HINT, initialHintState, isHintReady, recordFailure, recordProgress, starsFor, spendHint } from "./hints";

const fail = (n: number, state = initialHintState(0)) => Array.from({ length: n }).reduce<typeof state>((s) => recordFailure(s), state);

describe("hint readiness", () => {
  it("is not ready at the start", () => {
    expect(isHintReady(initialHintState(0), 1000)).toBe(false);
  });

  it("lights up after 5 failures", () => {
    expect(isHintReady(fail(4), 1000)).toBe(false);
    expect(isHintReady(fail(5), 1000)).toBe(true);
  });

  it("lights up after 2 minutes without progress", () => {
    expect(isHintReady(initialHintState(0), IDLE_MS_FOR_HINT - 1)).toBe(false);
    expect(isHintReady(initialHintState(0), IDLE_MS_FOR_HINT)).toBe(true);
  });

  it("progress resets the idle clock but not the failure count", () => {
    const state = recordProgress(fail(5), IDLE_MS_FOR_HINT);
    expect(isHintReady(state, IDLE_MS_FOR_HINT + 1000)).toBe(true);
    expect(isHintReady(recordProgress(initialHintState(0), 60_000), IDLE_MS_FOR_HINT + 1000)).toBe(false);
  });

  it("using a hint resets both counters", () => {
    const used = spendHint(fail(6), 5000);
    expect(isHintReady(used, 6000)).toBe(false);
    expect(used.hintsUsed).toBe(1);
    expect(used.totalFailures).toBe(6);
  });
});

describe("starsFor", () => {
  it("gives 3 stars for a clean solve", () => {
    expect(starsFor(fail(2))).toBe(3);
  });

  it("gives 2 stars with one hint or a few more misses", () => {
    expect(starsFor(spendHint(fail(2), 0))).toBe(2);
    expect(starsFor(fail(8))).toBe(2);
  });

  it("never gives fewer than 1 star", () => {
    expect(starsFor(spendHint(spendHint(fail(30), 0), 0))).toBe(1);
  });
});
