"use client";

/* eslint-disable @next/next/no-img-element -- preview of the parent's own clue photo */
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { DEFAULT_CROP, MIN_CROP, clampCrop, type Crop } from "@/puzzles/jigsaw/crop";
import { Segmented } from "./ui";

type Props = { photoUrl: string; crop?: Crop; onChange: (crop: Crop | undefined) => void };

const LOOSEST = 0.7;
const NUDGE = 0.02;

/**
 * Pick the jigsaw's mystery close-up: drag the box onto a detail of the clue
 * photo and set how close with the slider. The puzzle is cut from just that
 * part; finishing it zooms out to the whole photo.
 */
export function JigsawCropField({ photoUrl, crop, onChange }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; from: Crop } | null>(null);

  const move = (next: Crop) => onChange(clampCrop(next));

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!crop) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, from: crop };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const box = frame.current?.getBoundingClientRect();
    if (!d || !box) return;
    move({ ...d.from, x: d.from.x + (event.clientX - d.startX) / box.width, y: d.from.y + (event.clientY - d.startY) / box.height });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!crop) return;
    const step = { ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0], ArrowUp: [0, -NUDGE], ArrowDown: [0, NUDGE] }[event.key];
    if (!step) return;
    event.preventDefault();
    move({ ...crop, x: crop.x + step[0], y: crop.y + step[1] });
  }

  /** Zoom about the box's centre, so the chosen detail stays put. */
  function setSize(size: number) {
    if (!crop) return;
    const cx = crop.x + crop.size / 2;
    const cy = crop.y + crop.size / 2;
    move({ x: cx - size / 2, y: cy - size / 2, size });
  }

  return (
    <div className="grid gap-3 rounded-[var(--radius-tile)] bg-tomato/8 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-sm font-bold text-ink">Jigsaw picture</span>
          <p className="max-w-[52ch] text-sm text-ink/70">
            A mystery close-up is much harder to guess halfway through. When the last piece clicks in, it zooms out to the whole photo.
          </p>
        </div>
        <Segmented<"whole" | "close">
          label="Jigsaw picture"
          options={[
            { value: "whole", label: "Whole photo" },
            { value: "close", label: "Mystery close-up" },
          ]}
          value={crop ? "close" : "whole"}
          onChange={(choice) => onChange(choice === "close" ? DEFAULT_CROP : undefined)}
        />
      </div>

      {crop && (
        <>
          <div ref={frame} className="relative w-full max-w-md touch-none overflow-hidden rounded-[var(--radius-tile)] select-none">
            <img src={photoUrl} alt="Clue photo" draggable={false} className="block h-auto w-full" />
            <div
              role="button"
              tabIndex={0}
              aria-roledescription="movable box"
              aria-label={`Close-up, ${Math.round((crop.x + crop.size / 2) * 100)}% across and ${Math.round((crop.y + crop.size / 2) * 100)}% down. Drag it, or use the arrow keys.`}
              className="absolute cursor-move rounded-[10px] border-4 border-sunflower shadow-[0_0_0_9999px_rgb(20_33_63_/_0.55)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cream"
              style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.size * 100}%`, height: `${crop.size * 100}%` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onKeyDown={onKeyDown}
              data-crop={`${crop.x.toFixed(3)},${crop.y.toFixed(3)},${crop.size.toFixed(3)}`}
            />
          </div>
          <label className="grid max-w-md gap-1">
            <span className="flex justify-between text-sm font-bold text-ink">
              <span>How close</span>
              <span className="font-normal text-ink/65">{crop.size <= 0.3 ? "Very close" : crop.size <= 0.5 ? "Close" : "A little closer"}</span>
            </span>
            <input
              type="range"
              min={MIN_CROP}
              max={LOOSEST}
              step={0.01}
              // Right means closer (a smaller box).
              value={MIN_CROP + LOOSEST - crop.size}
              onChange={(e) => setSize(MIN_CROP + LOOSEST - Number(e.target.value))}
              className="accent-tomato"
              aria-label="How close"
            />
          </label>
        </>
      )}
    </div>
  );
}
