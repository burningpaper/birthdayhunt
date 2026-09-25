/**
 * Counting Lock rules (spec §6.6).
 *
 * The child turns wheels (0-9 each). With 2 or 3 dials, each dial is one
 * wheel. A single dial allows 0-99, so it gets two wheels, tens and ones,
 * rather than asking a seven-year-old to tap "up" forty-seven times.
 */

export function wheelCount(digits: 1 | 2 | 3): number {
  return digits === 1 ? 2 : digits;
}

/** The dial values the wheels spell out. */
export function dialValues(digits: 1 | 2 | 3, wheels: number[]): number[] {
  return digits === 1 ? [wheels[0] * 10 + wheels[1]] : wheels.slice(0, digits);
}

/** Which dial a wheel belongs to (tens and ones both belong to dial 0). */
export function dialOfWheel(digits: 1 | 2 | 3, wheel: number): number {
  return digits === 1 ? 0 : wheel;
}

/** Turn a wheel one step, wrapping 9 → 0 and 0 → 9 like a real combination lock. */
export function spin(value: number, delta: 1 | -1): number {
  return (value + delta + 10) % 10;
}

export function checkDials(values: number[], answers: number[]): boolean[] {
  return values.map((value, i) => value === answers[i]);
}

/** A wrong dial to hint at, rotating through them on repeated hints. */
export function hintDial(correct: boolean[], hintNumber: number): number | null {
  const wrong = correct.map((ok, i) => (ok ? -1 : i)).filter((i) => i >= 0);
  return wrong.length === 0 ? null : wrong[(hintNumber - 1 + wrong.length) % wrong.length];
}

/** "Dial 2 is more than 3!" Direction without giving the answer away. */
export function hintText(dial: number, value: number, answer: number, dialCount: number): string {
  const name = dialCount === 1 ? "The number" : `Dial ${dial + 1}`;
  return answer > value ? `${name} is more than ${value}!` : `${name} is less than ${value}!`;
}
