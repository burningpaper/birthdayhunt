import { customAlphabet } from "nanoid";
import { DEFAULT_PUZZLE_ORDER, applyDifficulty, defaultPuzzle } from "./difficulty";
import type { Difficulty, Hunt, PuzzleType, Station } from "./schema";

// No 0/o, 1/l/i: keys may be read aloud or typed by a parent one day.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const newStationKey = customAlphabet(ALPHABET, 6);
const shortId = customAlphabet(ALPHABET, 6);

export const MIN_STATIONS = 3;
export const MAX_STATIONS = 10;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
}

export function newHuntId(title: string): string {
  const base = slugify(title) || "hunt";
  return `${base}-${shortId().slice(0, 4)}`;
}

export function newStation(order: number, type: PuzzleType, difficulty: Difficulty): Station {
  return {
    id: `s${shortId()}`,
    order,
    key: newStationKey(),
    hidingNote: "",
    puzzle: defaultPuzzle(type, difficulty),
    clue: { showText: false },
  };
}

export function newHunt(title: string, now: Date = new Date()): Hunt {
  const difficulty: Difficulty = "medium";
  return {
    id: newHuntId(title),
    title,
    createdAt: now.toISOString(),
    difficulty,
    status: "draft",
    stations: DEFAULT_PUZZLE_ORDER.map((type, i) => newStation(i + 1, type, difficulty)),
  };
}

/** Keep `order` equal to array position, 1-based. */
export function renumber(stations: Station[]): Station[] {
  return stations.map((s, i) => ({ ...s, order: i + 1 }));
}

/**
 * A copy for next year's birthday: same puzzle choices and hiding notes,
 * fresh keys (so last year's printed codes stop working), clue media cleared
 * so every photo gets re-shot, and back to draft.
 */
export function duplicateHunt(source: Hunt, now: Date = new Date()): Hunt {
  const title = `${source.title} (copy)`;
  return {
    ...source,
    id: newHuntId(source.title),
    title,
    createdAt: now.toISOString(),
    status: "draft",
    stations: source.stations.map((s) => ({
      ...s,
      id: `s${shortId()}`,
      key: newStationKey(),
      clue: { showText: s.clue.showText, text: s.clue.text },
    })),
  };
}

export function regenerateKeys(hunt: Hunt): Hunt {
  return { ...hunt, stations: hunt.stations.map((s) => ({ ...s, key: newStationKey() })) };
}

export function setHuntDifficulty(hunt: Hunt, difficulty: Difficulty): Hunt {
  return {
    ...hunt,
    difficulty,
    stations: hunt.stations.map((s) => ({ ...s, puzzle: applyDifficulty(s.puzzle, difficulty) })),
  };
}
