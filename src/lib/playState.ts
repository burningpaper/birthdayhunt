import type { Difficulty, Hunt, Progress, PuzzleConfig, PuzzleType, Station } from "./schema";
import { recordedLines, type VoiceLines } from "./voiceLines";

/**
 * Order enforcement (spec §5.2), as pure functions.
 *
 * `resolvePlayState` decides what a scan means. `toPlayResponse` turns that
 * decision into the JSON the child's iPad receives, and is the one place that
 * decides what may leave the server. A clue is only ever included once it has
 * been earned (the jigsaw photo is the single exception, because the photo is
 * the puzzle).
 */

export type PlayDecision =
  | { state: "invalid" }
  | { state: "play"; station: Station }
  | { state: "solved"; station: Station }
  | { state: "notYet"; lastEarned?: Station };

type ScanInput = {
  hunt: Hunt | null;
  progress: Progress;
  stationId: string;
  key: string | null;
  preview: boolean;
};

function sorted(hunt: Hunt): Station[] {
  return [...hunt.stations].sort((a, b) => a.order - b.order);
}

/** The first station, in order, that has not been solved yet. */
export function nextExpectedStation(hunt: Hunt, progress: Progress): Station | undefined {
  const done = new Set(progress.completedStationIds);
  return sorted(hunt).find((s) => !done.has(s.id));
}

/** The highest-ordered solved station: its clue is the one the child is chasing. */
export function lastEarnedStation(hunt: Hunt, progress: Progress): Station | undefined {
  const done = new Set(progress.completedStationIds);
  return sorted(hunt)
    .filter((s) => done.has(s.id))
    .at(-1);
}

export function resolvePlayState({ hunt, progress, stationId, key, preview }: ScanInput): PlayDecision {
  if (!hunt) return { state: "invalid" };
  const station = hunt.stations.find((s) => s.id === stationId);
  if (!station || station.key !== key) return { state: "invalid" };

  // The parent's test mode plays any station, in any order, on a draft hunt.
  if (preview) return { state: "play", station };
  if (hunt.status !== "active") return { state: "invalid" };

  if (progress.completedStationIds.includes(station.id)) return { state: "solved", station };
  if (nextExpectedStation(hunt, progress)?.id === station.id) return { state: "play", station };
  return { state: "notYet", lastEarned: lastEarnedStation(hunt, progress) };
}

export function isFinalStation(hunt: Hunt, station: Station): boolean {
  return sorted(hunt).at(-1)?.id === station.id;
}

/** Record a solve. Idempotent: solving twice changes nothing. */
export function recordSolve(hunt: Hunt, progress: Progress, station: Station, now: Date): Progress {
  if (progress.completedStationIds.includes(station.id)) return progress;
  const at = now.toISOString();
  const next: Progress = {
    ...progress,
    completedStationIds: [...progress.completedStationIds, station.id],
    solvedAt: { ...progress.solvedAt, [station.id]: at },
    startedAt: progress.startedAt ?? at,
  };
  if (isFinalStation(hunt, station)) next.finishedAt = at;
  return next;
}

// ---------- What the child's device receives ----------

export type ClueView = {
  photoUrl?: string;
  audioUrl?: string;
  /** Present only when the parent chose to show the text to the child. */
  text?: string;
  isFinal: boolean;
  treasureMessage?: string;
};

export type StationView = { id: string; order: number; total: number; puzzleType: PuzzleType };

export type PlayResponse =
  | { state: "invalid" }
  | {
      state: "play";
      childName?: string;
      voice?: VoiceLines;
      station: StationView;
      puzzle: PuzzleConfig;
      difficulty: Difficulty;
      /** Jigsaw only: the photo the pieces are cut from. */
      puzzlePhotoUrl?: string;
    }
  | { state: "solved"; childName?: string; voice?: VoiceLines; station: StationView; clue: ClueView }
  | { state: "notYet"; childName?: string; voice?: VoiceLines; lastEarnedClue?: ClueView };

function stationView(hunt: Hunt, station: Station): StationView {
  return { id: station.id, order: station.order, total: hunt.stations.length, puzzleType: station.puzzle.type };
}

export function clueView(hunt: Hunt, station: Station): ClueView {
  const isFinal = isFinalStation(hunt, station);
  const { photoUrl, audioUrl, text, showText } = station.clue;
  return {
    photoUrl,
    audioUrl,
    text: showText && text?.trim() ? text : undefined,
    isFinal,
    treasureMessage: isFinal ? hunt.treasureMessage : undefined,
  };
}

export function toPlayResponse(hunt: Hunt | null, decision: PlayDecision): PlayResponse {
  if (!hunt || decision.state === "invalid") return { state: "invalid" };
  const childName = hunt.childName;
  // The hunt's recorded voice lines: generic prompts, never clue content, so every state may carry them.
  const voice = recordedLines(hunt.voiceLines);

  switch (decision.state) {
    case "play": {
      const { station } = decision;
      return {
        state: "play",
        childName,
        voice,
        station: stationView(hunt, station),
        puzzle: station.puzzle,
        difficulty: hunt.difficulty,
        puzzlePhotoUrl: station.puzzle.type === "jigsaw" ? station.clue.photoUrl : undefined,
      };
    }
    case "solved":
      return {
        state: "solved",
        childName,
        voice,
        station: stationView(hunt, decision.station),
        clue: clueView(hunt, decision.station),
      };
    case "notYet":
      return {
        state: "notYet",
        childName,
        voice,
        lastEarnedClue: decision.lastEarned ? clueView(hunt, decision.lastEarned) : undefined,
      };
  }
}
