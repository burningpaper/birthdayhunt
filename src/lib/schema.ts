import { z } from "zod";
import { VOICE_LINE_IDS } from "./voiceLines";

/**
 * The data model from spec §4, as zod schemas. Types are inferred from these,
 * so the API input checks and the TypeScript types can never drift apart.
 *
 * The schemas describe a *storable* hunt, which may be an unfinished draft.
 * Whether a hunt is ready to go live is a separate question, answered by
 * `huntProblems()` in validation.ts.
 */

export const PUZZLE_TYPES = [
  "jigsaw",
  "marbleRun",
  "trainTrack",
  "memoryMatch",
  "flickGolf",
  "countingLock",
] as const;

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

const mediaUrl = z.string().min(1).max(2048);

export const CropSchema = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), size: z.number().min(0.2).max(1) })
  .refine((c) => c.x + c.size <= 1.0001 && c.y + c.size <= 1.0001, "The close-up must stay inside the photo");

export const LockQuestionSchema = z.object({
  questionText: z.string().max(200),
  questionAudioUrl: mediaUrl.optional(),
  answer: z.number().int().min(0).max(99),
});

export const PuzzleConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("jigsaw"),
    pieces: z.union([z.literal(6), z.literal(9), z.literal(12), z.literal(16)]),
    rotation: z.boolean(),
    /**
     * A mystery close-up of the clue photo to build instead of the whole
     * thing (fractions of the photo; same shape as the photo). Finishing it
     * zooms out to the full photo. None means the whole photo.
     */
    crop: CropSchema.optional(),
  }),
  z.object({
    type: z.literal("marbleRun"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  }),
  z.object({
    type: z.literal("trainTrack"),
    gridSize: z.union([z.literal(4), z.literal(5), z.literal(6)]),
  }),
  z.object({
    type: z.literal("memoryMatch"),
    pairs: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
    photoUrls: z.array(mediaUrl).max(8).optional(),
  }),
  z.object({
    type: z.literal("flickGolf"),
    holes: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  }),
  z.object({
    type: z.literal("countingLock"),
    digits: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    questions: z.array(LockQuestionSchema).max(3),
  }),
]);

export const ClueSchema = z.object({
  photoUrl: mediaUrl.optional(),
  audioUrl: mediaUrl.optional(),
  text: z.string().max(300).optional(),
  showText: z.boolean(),
});

export const StationSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{1,16}$/),
  order: z.number().int().min(1),
  key: z.string().regex(/^[a-z0-9]{6}$/),
  hidingNote: z.string().max(200),
  puzzle: PuzzleConfigSchema,
  clue: ClueSchema,
});

export const HuntSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,40}$/),
  title: z.string().min(1).max(80),
  childName: z.string().max(40).optional(),
  createdAt: z.string(),
  difficulty: z.enum(DIFFICULTIES),
  stations: z.array(StationSchema).min(1).max(10),
  treasureMessage: z.string().max(300).optional(),
  status: z.enum(["draft", "active"]),
  /**
   * Goes up by one on every save. A save must say which revision it was
   * based on, so a stale copy (a second tab, a page restored by Back) can
   * never overwrite newer work. Hunts saved before this existed read as 0.
   */
  revision: z.number().int().min(0).default(0),
  /** The hunt's recordings of the app's spoken lines (lib/voiceLines.ts). A line with none is silent. */
  voiceLines: z.partialRecord(z.enum(VOICE_LINE_IDS), mediaUrl).optional(),
});

export const ProgressSchema = z.object({
  huntId: z.string(),
  completedStationIds: z.array(z.string()),
  /** When each station was solved, for the parent's live progress view. */
  solvedAt: z.record(z.string(), z.string()),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
});

export type PuzzleType = (typeof PUZZLE_TYPES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type LockQuestion = z.infer<typeof LockQuestionSchema>;
export type PuzzleConfig = z.infer<typeof PuzzleConfigSchema>;
export type Clue = z.infer<typeof ClueSchema>;
export type Station = z.infer<typeof StationSchema>;
export type Hunt = z.infer<typeof HuntSchema>;
export type Progress = z.infer<typeof ProgressSchema>;

export function emptyProgress(huntId: string): Progress {
  return { huntId, completedStationIds: [], solvedAt: {} };
}
