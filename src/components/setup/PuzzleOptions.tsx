"use client";

import { withLockDigits } from "@/lib/difficulty";
import type { LockQuestion, PuzzleConfig } from "@/lib/schema";
import { Field, Segmented, TextInput, Toggle } from "./ui";

type Props = { puzzle: PuzzleConfig; onChange: (puzzle: PuzzleConfig) => void };

const numbers = <T extends number>(values: readonly T[], suffix = "") =>
  values.map((value) => ({ value, label: `${value}${suffix}` }));

/** The knobs for whichever puzzle this station uses. */
export function PuzzleOptions({ puzzle, onChange }: Props) {
  switch (puzzle.type) {
    case "jigsaw":
      return (
        <div className="flex flex-wrap items-center gap-6">
          <Segmented label="Pieces" options={numbers([6, 9, 12, 16] as const, " pieces")} value={puzzle.pieces} onChange={(pieces) => onChange({ ...puzzle, pieces })} />
          <Toggle label="Pieces start rotated" checked={puzzle.rotation} onChange={(rotation) => onChange({ ...puzzle, rotation })} />
        </div>
      );
    case "marbleRun":
      return <Segmented label="Level" options={numbers([1, 2, 3, 4, 5] as const).map((o) => ({ ...o, label: `Level ${o.value}` }))} value={puzzle.level} onChange={(level) => onChange({ ...puzzle, level })} />;
    case "trainTrack":
      return <Segmented label="Grid size" options={([4, 5, 6] as const).map((v) => ({ value: v, label: `${v} × ${v}` }))} value={puzzle.gridSize} onChange={(gridSize) => onChange({ ...puzzle, gridSize })} />;
    case "memoryMatch":
      return <Segmented label="Pairs" options={numbers([6, 8, 10, 12] as const, " pairs")} value={puzzle.pairs} onChange={(pairs) => onChange({ ...puzzle, pairs })} />;
    case "flickGolf":
      return <Segmented label="Holes" options={numbers([1, 2, 3, 4, 5] as const).map((o) => ({ ...o, label: o.value === 1 ? "1 hole" : `${o.value} holes` }))} value={puzzle.holes} onChange={(holes) => onChange({ ...puzzle, holes })} />;
    case "countingLock":
      return <LockOptions puzzle={puzzle} onChange={onChange} />;
  }
}

function LockOptions({ puzzle, onChange }: { puzzle: PuzzleConfig & { type: "countingLock" }; onChange: (p: PuzzleConfig) => void }) {
  const max = puzzle.digits === 1 ? 99 : 9;

  const setQuestion = (index: number, patch: Partial<LockQuestion>) =>
    onChange({ ...puzzle, questions: puzzle.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)) });

  return (
    <div className="grid gap-4">
      <Segmented
        label="Dials"
        options={([1, 2, 3] as const).map((v) => ({ value: v, label: v === 1 ? "1 dial (0 to 99)" : `${v} dials` }))}
        value={puzzle.digits}
        onChange={(digits) => onChange(withLockDigits(puzzle, digits))}
      />
      <ol className="grid gap-3">
        {puzzle.questions.map((question, i) => (
          <li key={i} className="grid gap-3 rounded-[var(--radius-tile)] bg-bubblegum/8 p-4 sm:grid-cols-[1fr_8rem]">
            <Field label={`Dial ${i + 1} question`} hint="Something to count around the house. Simple sums work too.">
              <TextInput value={question.questionText} placeholder="How many cushions are on the couch?" maxLength={200} onChange={(e) => setQuestion(i, { questionText: e.target.value })} />
            </Field>
            <Field label="Answer">
              <TextInput
                inputMode="numeric"
                value={String(question.answer)}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setQuestion(i, { answer: Math.min(max, Number(digitsOnly || 0)) });
                }}
                aria-describedby={`dial-${i}-range`}
              />
              <span id={`dial-${i}-range`} className="sr-only">From 0 to {max}</span>
            </Field>
          </li>
        ))}
      </ol>
    </div>
  );
}
