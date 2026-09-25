import type { Hunt, Station } from "./schema";

/** The spoken-style label the parent sees for a station's clue (spec §7.2). */
export function clueTargetLabel(station: Station, total: number): string {
  return station.order >= total ? "Clue to find the treasure" : `Clue to find station ${station.order + 1}`;
}

function stationProblems(station: Station, total: number): string[] {
  const problems: string[] = [];
  const label = `Station ${station.order}`;
  const hasShownText = station.clue.showText && Boolean(station.clue.text?.trim());

  if (!station.clue.photoUrl && !hasShownText) {
    problems.push(`${label}: add a clue photo or shown clue text (${clueTargetLabel(station, total).toLowerCase()})`);
  }
  if (station.puzzle.type === "jigsaw" && !station.clue.photoUrl) {
    problems.push(`${label}: the jigsaw needs a clue photo, because the photo is the puzzle`);
  }
  if (station.puzzle.type === "countingLock") {
    const { digits, questions } = station.puzzle;
    if (questions.length !== digits) {
      problems.push(`${label}: the lock needs one question per dial`);
    }
    questions.forEach((q, i) => {
      if (!q.questionText.trim()) problems.push(`${label}: write the question for dial ${i + 1}`);
      const max = digits === 1 ? 99 : 9;
      if (q.answer > max) problems.push(`${label}: dial ${i + 1}'s answer must be ${max} or less`);
    });
  }
  return problems;
}

/**
 * Everything standing between this hunt and going live. An empty list means
 * it is ready. Shown to the parent as a checklist (spec §7.2).
 */
export function huntProblems(hunt: Hunt): string[] {
  const problems: string[] = [];
  if (hunt.stations.length < 3) problems.push("A hunt needs at least 3 stations");
  const total = hunt.stations.length;
  for (const station of hunt.stations) problems.push(...stationProblems(station, total));
  return problems;
}
