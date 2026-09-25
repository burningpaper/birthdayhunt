"use client";

import { ArrowDown, ArrowUp, Play, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { PuzzleIcon } from "@/components/PuzzleIcon";
import { defaultPuzzle } from "@/lib/difficulty";
import { PUZZLE_META } from "@/lib/puzzleMeta";
import { PUZZLE_TYPES, type Difficulty, type PuzzleType, type Station } from "@/lib/schema";
import type { MediaMode } from "@/lib/uploadClient";
import { clueTargetLabel } from "@/lib/validation";
import { CluePhotoField } from "./CluePhotoField";
import { PuzzleOptions } from "./PuzzleOptions";
import { Field, Panel, QuietButton, Select, TextArea, TextInput, Toggle } from "./ui";
import { VoiceRecorder } from "./VoiceRecorder";

type Props = {
  station: Station;
  total: number;
  difficulty: Difficulty;
  mediaMode: MediaMode;
  canRemove: boolean;
  onChange: (station: Station) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onTest: () => void;
};

export function StationCard({ station, total, difficulty, mediaMode, canRemove, onChange, onMove, onRemove, onTest }: Props) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const meta = PUZZLE_META[station.puzzle.type];
  const set = (patch: Partial<Station>) => onChange({ ...station, ...patch });
  const setClue = (patch: Partial<Station["clue"]>) => set({ clue: { ...station.clue, ...patch } });

  return (
    <Panel className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`plastic plastic-${meta.color} is-tile grid size-12 place-items-center`}>
            <PuzzleIcon type={station.puzzle.type} size={28} />
          </span>
          <h2 className="font-display text-3xl text-ink">Station {station.order}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuietButton onClick={onTest}>
            <Play weight="fill" size={18} />
            Test station
          </QuietButton>
          <QuietButton onClick={() => onMove(-1)} disabled={station.order === 1} aria-label="Move station up">
            <ArrowUp weight="bold" size={18} />
          </QuietButton>
          <QuietButton onClick={() => onMove(1)} disabled={station.order === total} aria-label="Move station down">
            <ArrowDown weight="bold" size={18} />
          </QuietButton>
          {confirmingRemove ? (
            <>
              <QuietButton tone="danger" onClick={onRemove}>Remove</QuietButton>
              <QuietButton onClick={() => setConfirmingRemove(false)}>Keep</QuietButton>
            </>
          ) : (
            <QuietButton tone="danger" disabled={!canRemove} onClick={() => setConfirmingRemove(true)} aria-label="Remove station">
              <Trash weight="bold" size={18} />
            </QuietButton>
          )}
        </div>
      </header>

      <Field label="Where you'll hide this QR code" hint="Only you see this. It's printed in tiny grey text under the code.">
        <TextInput value={station.hidingNote} placeholder="Inside the laundry basket" maxLength={200} onChange={(e) => set({ hidingNote: e.target.value })} />
      </Field>

      <div className="grid gap-4 rounded-[var(--radius-button)] border-2 border-ink/8 p-5">
        <Field label="Puzzle">
          <Select
            value={station.puzzle.type}
            onChange={(e) => set({ puzzle: defaultPuzzle(e.target.value as PuzzleType, difficulty) })}
          >
            {PUZZLE_TYPES.map((type) => (
              <option key={type} value={type} disabled={!PUZZLE_META[type].ready && station.puzzle.type !== type}>
                {PUZZLE_META[type].name}
                {PUZZLE_META[type].ready ? "" : " (coming soon)"}
              </option>
            ))}
          </Select>
        </Field>
        <PuzzleOptions puzzle={station.puzzle} mediaMode={mediaMode} onChange={(puzzle) => set({ puzzle })} />
      </div>

      <div className="grid gap-4 rounded-[var(--radius-button)] bg-sunflower/12 p-5">
        <div>
          <h3 className="font-display text-2xl text-ink">{clueTargetLabel(station, total)}</h3>
          <p className="text-base text-ink/70">
            Revealed after this puzzle is solved.{" "}
            {station.order < total ? `Photograph where you'll hide station ${station.order + 1}.` : "Photograph where the treasure is."}
            {station.puzzle.type === "jigsaw" && " This photo is also the jigsaw picture."}
          </p>
        </div>
        <CluePhotoField url={station.clue.photoUrl} mediaMode={mediaMode} onChange={(photoUrl) => setClue({ photoUrl })} />
        <div className="grid gap-2">
          <span className="text-sm font-bold text-ink">Voice clue (optional)</span>
          <VoiceRecorder url={station.clue.audioUrl} mediaMode={mediaMode} onChange={(audioUrl) => setClue({ audioUrl })} />
          <span className="text-sm text-ink/65">Plays automatically when the clue appears, with a big replay button.</span>
        </div>
        <Field label="Clue text (optional)" hint="A riddle or a hint. Turn it on to show it big on screen, and it's read aloud too.">
          <TextArea value={station.clue.text ?? ""} placeholder="I keep things cold and hum all night" maxLength={300} onChange={(e) => setClue({ text: e.target.value || undefined })} />
        </Field>
        <Toggle label="Show this text to your child" checked={station.clue.showText} onChange={(showText) => setClue({ showText })} />
      </div>
    </Panel>
  );
}
