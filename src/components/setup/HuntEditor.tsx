"use client";

import { ArrowLeft, CheckCircle, Plus, Printer, Rocket, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { DEFAULT_PUZZLE_ORDER } from "@/lib/difficulty";
import { MAX_STATIONS, MIN_STATIONS, newStation, renumber, setHuntDifficulty } from "@/lib/huntFactory";
import type { Difficulty, Hunt, Progress, Station } from "@/lib/schema";
import type { MediaMode } from "@/lib/uploadClient";
import { huntProblems } from "@/lib/validation";
import { StatusBadge } from "./HuntList";
import { ProgressPanel } from "./ProgressPanel";
import { StationCard } from "./StationCard";
import { Field, Panel, QuietButton, Segmented, TextArea, TextInput } from "./ui";
import { useAutosave, type SaveStatus } from "./useAutosave";

type Props = { initialHunt: Hunt; initialProgress: Progress; mediaMode: MediaMode };

export function HuntEditor({ initialHunt, initialProgress, mediaMode }: Props) {
  const [hunt, setHunt] = useState(initialHunt);
  const { status, flush } = useAutosave(hunt);
  const problems = useMemo(() => huntProblems(hunt), [hunt]);

  const update = (patch: Partial<Hunt>) => setHunt((h) => ({ ...h, ...patch }));
  const setStations = (fn: (stations: Station[]) => Station[]) => setHunt((h) => ({ ...h, stations: renumber(fn(h.stations)) }));

  const moveStation = (index: number, direction: -1 | 1) =>
    setStations((stations) => {
      const next = [...stations];
      const [moved] = next.splice(index, 1);
      next.splice(index + direction, 0, moved);
      return next;
    });

  const addStation = () =>
    setStations((stations) => [
      ...stations,
      newStation(stations.length + 1, DEFAULT_PUZZLE_ORDER[stations.length % DEFAULT_PUZZLE_ORDER.length], hunt.difficulty),
    ]);

  /** Open the tab synchronously (Safari blocks pop-ups after an await), then point it at the saved station. */
  async function testStation(station: Station) {
    const tab = window.open("about:blank", "_blank");
    const saved = await flush();
    const url = `/h/${hunt.id}/s/${station.id}?k=${station.key}&preview=1`;
    if (tab && saved) tab.location.href = url;
    else tab?.close();
  }

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/setup" className="inline-flex items-center gap-2 rounded-[var(--radius-tile)] text-base font-semibold text-ink/70 hover:text-ink focus-visible:outline-3 focus-visible:outline-cobalt">
          <ArrowLeft weight="bold" size={18} />
          All hunts
        </Link>
        <SaveIndicator status={status} />
      </div>

      <Panel className="grid gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-ink">{hunt.title || "Untitled hunt"}</h1>
          <StatusBadge status={hunt.status} />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Hunt title">
            <TextInput value={hunt.title} maxLength={80} onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label="Child's name" hint="Used in greetings like “You found one, Sam!”">
            <TextInput value={hunt.childName ?? ""} maxLength={40} onChange={(e) => update({ childName: e.target.value || undefined })} />
          </Field>
        </div>
        <Field label="Treasure message (optional)" hint="Shown with the very last clue.">
          <TextArea value={hunt.treasureMessage ?? ""} maxLength={300} placeholder="Happy birthday! You cracked every puzzle." onChange={(e) => update({ treasureMessage: e.target.value || undefined })} />
        </Field>
        <div className="grid gap-2">
          <span className="text-sm font-bold text-ink">Difficulty</span>
          <Segmented<Difficulty>
            label="Difficulty"
            options={[
              { value: "easy", label: "Easy" },
              { value: "medium", label: "Medium (age 7)" },
              { value: "hard", label: "Hard" },
            ]}
            value={hunt.difficulty}
            onChange={(difficulty) => setHunt((h) => setHuntDifficulty(h, difficulty))}
          />
          <span className="text-sm text-ink/65">Sets every puzzle at once. You can still adjust stations one by one below.</span>
        </div>
      </Panel>

      <ReadinessPanel hunt={hunt} problems={problems} onStatus={(next) => update({ status: next })} />

      <ProgressPanel hunt={hunt} initialProgress={initialProgress} onRekeyed={(rekeyed) => setHunt((h) => ({ ...h, stations: h.stations.map((s) => ({ ...s, key: rekeyed.stations.find((r) => r.id === s.id)?.key ?? s.key })) }))} flush={flush} />

      <div className="grid gap-6">
        {hunt.stations.map((station, index) => (
          <StationCard
            key={station.id}
            station={station}
            total={hunt.stations.length}
            difficulty={hunt.difficulty}
            mediaMode={mediaMode}
            canRemove={hunt.stations.length > MIN_STATIONS}
            onChange={(next) => setStations((stations) => stations.map((s) => (s.id === next.id ? next : s)))}
            onMove={(direction) => moveStation(index, direction)}
            onRemove={() => setStations((stations) => stations.filter((s) => s.id !== station.id))}
            onTest={() => void testStation(station)}
          />
        ))}
      </div>

      {hunt.stations.length < MAX_STATIONS && (
        <div className="grid justify-items-center">
          <QuietButton onClick={addStation}>
            <Plus weight="bold" size={18} />
            Add a station
          </QuietButton>
        </div>
      )}

      <div className="grid justify-items-center pb-10">
        <Link href={`/setup/hunts/${hunt.id}/print`} className="inline-flex items-center gap-2 text-base font-semibold text-cobalt underline-offset-4 hover:underline">
          <Printer weight="fill" size={20} />
          Print the QR codes
        </Link>
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const text = { saved: "All changes saved", pending: "Saving soon…", saving: "Saving…", error: status.kind === "error" ? status.message : "" }[status.kind];
  return (
    <span role="status" className={`text-sm font-semibold ${status.kind === "error" ? "text-[#B42318]" : "text-ink/60"}`}>
      {text}
    </span>
  );
}

function ReadinessPanel({ hunt, problems, onStatus }: { hunt: Hunt; problems: string[]; onStatus: (status: Hunt["status"]) => void }) {
  if (hunt.status === "active") {
    return (
      <Panel className="flex flex-wrap items-center justify-between gap-4 border-2 border-grass/40">
        <div className="flex items-center gap-3">
          <CheckCircle weight="fill" size={32} className="text-grass" />
          <div>
            <h2 className="font-display text-2xl text-ink">This hunt is live</h2>
            <p className="text-base text-ink/70">Scanning a printed code starts the game.</p>
          </div>
        </div>
        <QuietButton onClick={() => onStatus("draft")}>Switch back to draft</QuietButton>
      </Panel>
    );
  }

  return (
    <Panel className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-ink">{problems.length === 0 ? "Ready to go live" : "Before it can go live"}</h2>
          <p className="text-base text-ink/70">Draft hunts can only be played with Test station.</p>
        </div>
        <PlasticButton color="grass" size="sm" disabled={problems.length > 0} onClick={() => onStatus("active")}>
          <Rocket weight="fill" size={22} />
          Go live
        </PlasticButton>
      </div>
      {problems.length > 0 && (
        <ul className="grid gap-2">
          {problems.map((problem) => (
            <li key={problem} className="flex items-start gap-2 text-base text-ink">
              <WarningCircle weight="fill" size={22} className="mt-0.5 shrink-0 text-tangerine" />
              {problem}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
