"use client";

import { ArrowsClockwise, CheckCircle, Circle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useHydrated } from "@/components/useHydrated";
import { formatTime } from "@/lib/format";
import { PUZZLE_META } from "@/lib/puzzleMeta";
import type { Hunt, Progress } from "@/lib/schema";
import { Panel, QuietButton } from "./ui";

const POLL_MS = 10_000;

type Props = {
  hunt: Hunt;
  initialProgress: Progress;
  flush: () => Promise<boolean>;
  onRekeyed: (hunt: Hunt) => void;
};

/** Live progress on the day, plus the two "start over" levers: reset and re-key. */
export function ProgressPanel({ hunt, initialProgress, flush, onRekeyed }: Props) {
  const hydrated = useHydrated();
  const [progress, setProgress] = useState(initialProgress);
  const [confirming, setConfirming] = useState<"reset" | "rekey" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll while the tab is visible, so a parent can watch the hunt unfold.
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/setup/hunts/${hunt.id}`);
        if (res.ok) setProgress(((await res.json()) as { progress: Progress }).progress);
      } catch (err) {
        console.warn("[setup] progress refresh failed", err);
      }
    };
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [hunt.id]);

  async function run(action: "reset" | "rekey") {
    setError(null);
    try {
      if (action === "rekey" && !(await flush())) throw new Error("save before re-key failed");
      const res = await fetch(`/api/setup/hunts/${hunt.id}/${action === "reset" ? "reset" : "regenerate-keys"}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (action === "reset") setProgress({ huntId: hunt.id, completedStationIds: [], solvedAt: {} });
      else onRekeyed(((await res.json()) as { hunt: Hunt }).hunt);
      setConfirming(null);
    } catch (err) {
      console.error(`[setup] ${action} failed`, err);
      setError("That didn't work. Try again.");
    }
  }

  const found = progress.completedStationIds.length;

  return (
    <Panel className="grid gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl text-ink">
          Progress: {found} / {hunt.stations.length} found
        </h2>
        {progress.finishedAt && <span className="text-base font-bold text-[#146B32]">Treasure found!</span>}
      </div>

      <ol className="flex flex-wrap gap-2">
        {hunt.stations.map((station) => {
          const at = progress.solvedAt[station.id];
          const meta = PUZZLE_META[station.puzzle.type];
          return (
            <li key={station.id} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${at ? "bg-grass/15 text-[#146B32]" : "bg-ink/6 text-ink/60"}`} title={meta.name}>
              {at ? <CheckCircle weight="fill" size={18} /> : <Circle weight="bold" size={18} />}
              {station.order}
              {at && hydrated && <span className="font-normal">{formatTime(at)}</span>}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        {confirming === "reset" ? (
          <>
            <span className="text-base font-semibold">Clear all progress?</span>
            <QuietButton tone="danger" onClick={() => void run("reset")}>Yes, reset</QuietButton>
            <QuietButton onClick={() => setConfirming(null)}>Cancel</QuietButton>
          </>
        ) : confirming === "rekey" ? (
          <>
            <span className="text-base font-semibold">Old printed codes will stop working. Continue?</span>
            <QuietButton tone="danger" onClick={() => void run("rekey")}>Yes, new codes</QuietButton>
            <QuietButton onClick={() => setConfirming(null)}>Cancel</QuietButton>
          </>
        ) : (
          <>
            <QuietButton onClick={() => setConfirming("reset")} disabled={found === 0}>Reset progress</QuietButton>
            <QuietButton onClick={() => setConfirming("rekey")}>
              <ArrowsClockwise weight="bold" size={18} />
              New QR codes
            </QuietButton>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p>}
    </Panel>
  );
}
