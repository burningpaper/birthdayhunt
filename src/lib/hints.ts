/**
 * When the hint button lights up (spec §5.3): after 5 failed attempts, or
 * 2 minutes without progress. Using a hint starts both counters again, so
 * hints stay a choice the child makes, never a crutch that stays lit.
 */

export const FAILURES_FOR_HINT = 5;
export const IDLE_MS_FOR_HINT = 2 * 60 * 1000;

export type HintState = {
  /** Failures since the last hint (or since the start). */
  failuresSinceHint: number;
  /** Last time the child made progress or used a hint. */
  lastProgressAt: number;
  /** Totals for the star rating. */
  totalFailures: number;
  hintsUsed: number;
};

export function initialHintState(now: number): HintState {
  return { failuresSinceHint: 0, lastProgressAt: now, totalFailures: 0, hintsUsed: 0 };
}

export function recordFailure(state: HintState): HintState {
  return { ...state, failuresSinceHint: state.failuresSinceHint + 1, totalFailures: state.totalFailures + 1 };
}

export function recordProgress(state: HintState, now: number): HintState {
  return { ...state, lastProgressAt: now };
}

export function spendHint(state: HintState, now: number): HintState {
  return { ...state, failuresSinceHint: 0, lastProgressAt: now, hintsUsed: state.hintsUsed + 1 };
}

export function isHintReady(state: HintState, now: number): boolean {
  return state.failuresSinceHint >= FAILURES_FOR_HINT || now - state.lastProgressAt >= IDLE_MS_FOR_HINT;
}

/** 1 to 3 stars (spec §5.3). Rewards only; it never blocks anything. */
export function starsFor(state: HintState): 1 | 2 | 3 {
  if (state.hintsUsed === 0 && state.totalFailures <= 3) return 3;
  if (state.hintsUsed <= 1 && state.totalFailures <= 12) return 2;
  return 1;
}
