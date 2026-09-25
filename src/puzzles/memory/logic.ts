/**
 * Memory Match rules (spec §6.4), as a pure reducer so they can be tested
 * without a screen. Faces are either the parent's photos or built-in
 * illustrations, identified by a string id.
 */

import { shuffle, type Rng } from "../random";

export type Face = { id: string; kind: "photo"; url: string } | { id: string; kind: "icon"; icon: string; color: string };

/** Built-in faces: bright, generic things. No characters from anyone's franchise. */
export const BUILT_IN_FACES: Face[] = [
  ["Car", "tomato"],
  ["AirplaneTilt", "cobalt"],
  ["Sailboat", "grass"],
  ["RocketLaunch", "bubblegum"],
  ["Tractor", "tangerine"],
  ["Bicycle", "sunflower"],
  ["Cat", "cobalt"],
  ["Dog", "tangerine"],
  ["Fish", "bubblegum"],
  ["Butterfly", "grass"],
  ["Rabbit", "tomato"],
  ["Bird", "sunflower"],
  ["Hammer", "grass"],
  ["Wrench", "tomato"],
  ["PaintBrush", "cobalt"],
  ["Scissors", "sunflower"],
].map(([icon, color]) => ({ id: `icon:${icon}`, kind: "icon", icon, color }) as Face);

/** The parent's photos first (they're the fun ones), then built-ins to make up the pairs. */
export function chooseFaces(pairs: number, photoUrls: string[] | undefined, rng: Rng): Face[] {
  const photos: Face[] = (photoUrls ?? []).slice(0, pairs).map((url, i) => ({ id: `photo:${i}`, kind: "photo", url }));
  const icons = shuffle(BUILT_IN_FACES, rng).slice(0, pairs - photos.length);
  return [...photos, ...icons];
}

export function dealDeck(faces: Face[], rng: Rng): string[] {
  return shuffle(faces.flatMap((f) => [f.id, f.id]), rng);
}

/** Landscape grids that stay close to square cards. */
export function gridFor(cardCount: number): { cols: number; rows: number } {
  const table: Record<number, [number, number]> = { 12: [4, 3], 16: [4, 4], 20: [5, 4], 24: [6, 4] };
  const [cols, rows] = table[cardCount] ?? [Math.ceil(Math.sqrt(cardCount * 1.5)), Math.ceil(cardCount / Math.ceil(Math.sqrt(cardCount * 1.5)))];
  return { cols, rows };
}

export type MemoryState = {
  deck: string[];
  matched: boolean[];
  /** Face-up, unmatched cards: zero, one or two. */
  open: number[];
  /** A mismatched pair is showing and will flip back: taps are ignored. */
  locked: boolean;
};

export type MemoryAction = { type: "flip"; index: number } | { type: "hide" };

export function initialState(deck: string[]): MemoryState {
  return { deck, matched: deck.map(() => false), open: [], locked: false };
}

export function reduce(state: MemoryState, action: MemoryAction): MemoryState {
  if (action.type === "hide") return { ...state, open: [], locked: false };

  const { index } = action;
  if (state.locked || state.matched[index] || state.open.includes(index)) return state;
  if (state.open.length === 0) return { ...state, open: [index] };

  const first = state.open[0];
  if (state.deck[first] === state.deck[index]) {
    const matched = [...state.matched];
    matched[first] = true;
    matched[index] = true;
    return { ...state, matched, open: [] };
  }
  return { ...state, open: [first, index], locked: true };
}

export function isSolved(state: MemoryState): boolean {
  return state.matched.every(Boolean);
}

export function isFaceUp(state: MemoryState, index: number): boolean {
  return state.matched[index] || state.open.includes(index);
}
