import { PuzzleIcon } from "@/components/PuzzleIcon";
import { PUZZLE_META } from "@/lib/puzzleMeta";
import type { StationView } from "@/lib/playState";

/** The small badge in the corner: which station, and whose colour it is. */
export function StationChip({ station, preview }: { station: StationView; preview?: boolean }) {
  const meta = PUZZLE_META[station.puzzleType];
  return (
    <div className="pointer-events-none absolute top-5 left-5 z-10 flex items-center gap-3">
      <div className={`plastic plastic-${meta.color} flex items-center gap-2 px-4 py-2 font-display text-2xl`}>
        <PuzzleIcon type={station.puzzleType} size={28} />
        {station.order} of {station.total}
      </div>
      {preview && (
        <span className="rounded-full bg-cream/15 px-4 py-2 text-base font-semibold text-cream">
          Test mode: progress isn&apos;t saved
        </span>
      )}
    </div>
  );
}
