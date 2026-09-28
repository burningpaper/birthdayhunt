"use client";

import { CheckCircle, Gift, MapPin, TreasureChest } from "@phosphor-icons/react";
import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { PUZZLE_META } from "@/lib/puzzleMeta";
import type { Hunt } from "@/lib/schema";
import { Panel, QuietButton } from "./ui";

/**
 * The parent's walk-round list for setting up the real hunt: each station in
 * order, where its code goes and which gift goes with it, then the treasure,
 * and a tick box for each once it's placed. Ticks are kept in this browser
 * only (they're about one set-up session, not the hunt), so they never touch
 * the saved hunt.
 */

const CHANGED = "setup-checklist-changed";
const TREASURE = "treasure";
const storageKey = (huntId: string) => `setup-checklist:${huntId}`;

function readTicks(huntId: string): string {
  try {
    return localStorage.getItem(storageKey(huntId)) ?? "[]";
  } catch (error) {
    console.warn("[checklist] couldn't read ticks", error);
    return "[]";
  }
}

function writeTicks(huntId: string, ids: string[]) {
  try {
    localStorage.setItem(storageKey(huntId), JSON.stringify(ids));
  } catch (error) {
    console.warn("[checklist] couldn't save ticks", error);
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange); // another tab
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The ticked ids, from a string snapshot (so React only re-renders on a real change). */
function useTicks(huntId: string): [Set<string>, (ids: string[]) => void] {
  const raw = useSyncExternalStore(subscribe, () => readTicks(huntId), () => "[]");
  const ticked = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(raw));
    } catch {
      return new Set<string>();
    }
  }, [raw]);
  const set = useCallback((ids: string[]) => writeTicks(huntId, ids), [huntId]);
  return [ticked, set];
}

type RowProps = { badge: ReactNode; badgeClass: string; label: string; testId: string; where?: string; gift?: string; done: boolean; onToggle: () => void };

function ChecklistRow({ badge, badgeClass, label, testId, where, gift, done, onToggle }: RowProps) {
  const struck = done ? "line-through decoration-ink/40" : "";
  return (
    <li>
      <label
        className={`flex cursor-pointer items-center gap-4 rounded-[var(--radius-tile)] border p-3 transition-colors motion-reduce:transition-none ${done ? "border-grass/40 bg-grass/8" : "border-ink/10 hover:bg-ink/3"}`}
        data-station={testId}
      >
        <input type="checkbox" className="peer sr-only" checked={done} onChange={onToggle} aria-label={`${label} placed`} />
        <span className={`${badgeClass} is-round grid size-11 shrink-0 place-items-center font-display text-2xl`} aria-hidden>
          {badge}
        </span>
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="flex items-start gap-2 text-base text-ink">
            <MapPin weight="fill" size={20} className="mt-0.5 shrink-0 text-tomato" aria-hidden />
            <span className={struck}>{where?.trim() || <em className="text-ink/45">Hiding place not written yet</em>}</span>
          </span>
          <span className="flex items-start gap-2 text-base text-ink">
            <Gift weight="fill" size={20} className="mt-0.5 shrink-0 text-bubblegum" aria-hidden />
            <span className={struck}>{gift?.trim() || <em className="text-ink/45">No gift noted</em>}</span>
          </span>
        </span>
        <CheckCircle
          weight={done ? "fill" : "regular"}
          size={34}
          className={`shrink-0 rounded-full transition-transform peer-focus-visible:outline-3 peer-focus-visible:outline-cobalt motion-reduce:transition-none ${done ? "scale-110 text-grass" : "text-ink/25"}`}
          aria-hidden
        />
      </label>
    </li>
  );
}

export function SetupChecklist({ hunt }: { hunt: Hunt }) {
  const [ticked, setTicked] = useTicks(hunt.id);
  const ids = [...hunt.stations.map((s) => s.id), TREASURE];
  const placed = ids.filter((id) => ticked.has(id)).length;
  const toggle = (id: string) => setTicked(ticked.has(id) ? [...ticked].filter((t) => t !== id) : [...ticked, id]);

  return (
    <div data-testid="setup-checklist">
      <Panel className="grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1">
            <h2 className="font-display text-3xl text-ink">Set-up checklist</h2>
            <p className="text-base text-ink/65">Walk round the house with this: where each code goes, and the gift that goes with it. Tick each one off as you place it.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-paper px-3 py-1 text-base font-semibold text-ink" aria-live="polite">
              {placed} of {ids.length} placed
            </span>
            {placed > 0 && <QuietButton onClick={() => setTicked([])}>Clear ticks</QuietButton>}
          </div>
        </div>

        <ol className="grid gap-2">
          {hunt.stations.map((station) => (
            <ChecklistRow
              key={station.id}
              badge={station.order}
              badgeClass={`plastic plastic-${PUZZLE_META[station.puzzle.type].color}`}
              label={`Station ${station.order}`}
              testId={String(station.order)}
              where={station.hidingNote}
              gift={station.gift}
              done={ticked.has(station.id)}
              onToggle={() => toggle(station.id)}
            />
          ))}
          <ChecklistRow
            badge={<TreasureChest weight="fill" size={24} />}
            badgeClass="plastic plastic-sunflower"
            label="Treasure"
            testId="treasure"
            where={hunt.treasure?.hidingNote}
            gift={hunt.treasure?.gift}
            done={ticked.has(TREASURE)}
            onToggle={() => toggle(TREASURE)}
          />
        </ol>
      </Panel>
    </div>
  );
}
