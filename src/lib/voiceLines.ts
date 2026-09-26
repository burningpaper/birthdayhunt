import { PUZZLE_META } from "./puzzleMeta";

/**
 * Every line the app says out loud, other than each station's own clue and
 * lock questions. There is no text-to-speech: a line plays the hunt's
 * uploaded (or recorded) file, and until the parent adds one it simply
 * isn't said. The words are still on screen either way.
 */

export const VOICE_LINE_IDS = [
  "start.welcome",
  "instruction.jigsaw",
  "instruction.marbleRun",
  "instruction.trainTrack",
  "instruction.memoryMatch",
  "instruction.flickGolf",
  "instruction.countingLock",
  "celebrate.station",
  "celebrate.final",
  "clue.find",
  "clue.findTreasure",
  "notYet.anotherClue",
  "notYet.firstCode",
  "lock.closeSome",
  "lock.close",
  "lock.bigger",
  "lock.smaller",
] as const;

export type VoiceLineId = (typeof VOICE_LINE_IDS)[number];
/** A hunt's recordings, by line. A missing line is silent. */
export type VoiceLines = Partial<Record<VoiceLineId, string>>;

/** `freeform`: the parent says whatever they like, so `words` describes it rather than scripting it. */
export type VoiceLine = { id: VoiceLineId; group: string; words: string; when: string; freeform?: boolean };

export const VOICE_LINES: VoiceLine[] = [
  {
    id: "start.welcome",
    group: "Start screen",
    words: "Your welcome message, in your own words",
    freeform: true,
    when: "On the front page when this hunt is running: the big red button plays it, then the scanner opens for the first code",
  },
  ...(["jigsaw", "marbleRun", "trainTrack", "memoryMatch", "flickGolf", "countingLock"] as const).map((type) => ({
    id: `instruction.${type}` as VoiceLineId,
    group: "Puzzle instructions",
    words: PUZZLE_META[type].instruction,
    when: `When a ${PUZZLE_META[type].name} starts, and on its speaker button`,
  })),
  { id: "celebrate.station", group: "Celebrations", words: "You did it!", when: "After each puzzle is solved" },
  { id: "celebrate.final", group: "Celebrations", words: "You solved every puzzle!", when: "After the last puzzle" },
  { id: "clue.find", group: "Clues", words: "Go find it!", when: "With a clue that has no voice recording of its own" },
  { id: "clue.findTreasure", group: "Clues", words: "Go find the treasure!", when: "With the last clue, if it has no voice recording" },
  { id: "notYet.anotherClue", group: "Scanned too early", words: "Not yet! There's another clue to find first.", when: "On \"Not yet\", when a code is scanned out of order" },
  { id: "notYet.firstCode", group: "Scanned too early", words: "Not yet! Find the very first treasure code.", when: "On \"Not yet\", before the first code has been found" },
  { id: "lock.closeSome", group: "Counting Lock", words: "Close! The green ones are right. Check the others again.", when: "A wrong try with some dials right" },
  { id: "lock.close", group: "Counting Lock", words: "Close! Check again.", when: "A wrong try with no dials right" },
  { id: "lock.bigger", group: "Counting Lock", words: "It's a bigger number!", when: "Hint: a dial needs a bigger number (the exact one shows on screen)" },
  { id: "lock.smaller", group: "Counting Lock", words: "It's a smaller number!", when: "Hint: a dial needs a smaller number (the exact one shows on screen)" },
];

/** A hunt's recordings with any empty entries dropped, or undefined if there are none (so responses stay lean). */
export function recordedLines(lines: VoiceLines | undefined): VoiceLines | undefined {
  const kept = Object.fromEntries(Object.entries(lines ?? {}).filter(([, url]) => Boolean(url))) as VoiceLines;
  return Object.keys(kept).length > 0 ? kept : undefined;
}
