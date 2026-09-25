"use client";

import { HouseLine, LockSimple, Train } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { toot, tock } from "@/lib/audio/sfx";
import { seededRng } from "../random";
import type { PuzzleProps } from "../types";
import { useElementSize } from "../useElementSize";
import { E, N, S, connections, generate, opposite, routeNeeds, trace, turnsFor, type Board, type Pos } from "./logic";
import { TrackArt } from "./TrackArt";

const GAP = 6;
/** The ride takes about 0.2s per tile, but never less than 1.8s or more than 4s: long enough to enjoy, short enough to get to the clue. */
function rideSeconds(cells: number): number {
  return Math.min(4, Math.max(1.8, cells * 0.2));
}

/**
 * Fix the Train Track (spec §6.3). Tap tiles to turn them. When a track runs
 * all the way from the station to the building, the train chugs along it.
 */
export function TrainTrack({ config, onSolved, onProgress, hintRequest }: PuzzleProps) {
  const size = config.type === "trainTrack" ? config.gridSize : 4;
  const { ref, size: area } = useElementSize<HTMLDivElement>();
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const puzzle = useMemo(() => generate(size, seededRng(seed)), [size, seed]);
  const needs = useMemo(() => routeNeeds(puzzle.route), [puzzle]);

  const [tiles, setTiles] = useState(puzzle.board.tiles);
  const [locked, setLocked] = useState<Set<string>>(() => new Set());
  const [driving, setDriving] = useState(false);
  const board: Board = { ...puzzle.board, tiles };
  const path = trace(board);
  const [bestReach, setBestReach] = useState(path.cells.length);

  // A new hint: lock the first wrong tile on the planted route into place
  // (React's "adjust state when a prop changes" pattern).
  const [seenHint, setSeenHint] = useState(hintRequest);
  if (hintRequest !== seenHint) {
    setSeenHint(hintRequest);
    const wrong = puzzle.route.find((p) => {
      const key = `${p.x},${p.y}`;
      return !locked.has(key) && connections(tiles[p.y][p.x]) !== needs.get(key) && !(tiles[p.y][p.x].kind === "cross");
    });
    if (wrong) {
      const key = `${wrong.x},${wrong.y}`;
      const tile = tiles[wrong.y][wrong.x];
      const target = turnsFor(tile.kind, needs.get(key)!)!;
      // Turn forward to the target so the animation goes the short way round.
      const forward = (((target - tile.turns) % 4) + 4) % 4;
      setTiles(tiles.map((row, y) => row.map((t, x) => (x === wrong.x && y === wrong.y ? { ...t, turns: t.turns + forward } : t))));
      setLocked(new Set(locked).add(key));
    }
  }

  function turn(pos: Pos) {
    if (driving || locked.has(`${pos.x},${pos.y}`)) return;
    tock();
    const next = tiles.map((row, y) => row.map((t, x) => (x === pos.x && y === pos.y ? { ...t, turns: t.turns + 1 } : t)));
    setTiles(next);
    const result = trace({ ...puzzle.board, tiles: next });
    if (result.cells.length > bestReach) {
      setBestReach(result.cells.length);
      onProgress?.();
    }
    if (result.solved) {
      setDriving(true);
      toot();
    }
  }

  const tile = area ? Math.floor(Math.min((area.width - GAP * (size + 1)) / (size + 2.4), (area.height - GAP * (size - 1)) / size)) : 0;
  const lit = new Set(path.cells.map((c) => `${c.x},${c.y}`));

  return (
    <div ref={ref} className="grid h-full w-full place-items-center px-6 pb-6">
      {area && (
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `${tile * 1.2}px repeat(${size}, ${tile}px) ${tile * 1.2}px`, gridTemplateRows: `repeat(${size}, ${tile}px)`, gap: GAP }}
          data-start={puzzle.board.startRow}
          data-end={puzzle.board.endRow}
          data-size={size}
          aria-label="Train track"
        >
          <div className="plastic plastic-grass is-tile grid place-items-center" style={{ gridColumn: 1, gridRow: puzzle.board.startRow + 1 }} aria-label="Station">
            <Train weight="fill" size={tile * 0.55} />
          </div>
          <div className="plastic plastic-sunflower is-tile grid place-items-center" style={{ gridColumn: size + 2, gridRow: puzzle.board.endRow + 1 }} aria-label="Clue building">
            <HouseLine weight="fill" size={tile * 0.55} />
          </div>

          {tiles.map((row, y) =>
            row.map((t, x) => {
              const key = `${x},${y}`;
              const isLocked = locked.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => turn({ x, y })}
                  className={`track-tile plastic plastic-cream is-tile ${lit.has(key) ? "is-lit" : ""} ${isLocked ? "is-locked" : ""}`}
                  style={{ gridColumn: x + 2, gridRow: y + 1 }}
                  data-x={x}
                  data-y={y}
                  data-kind={t.kind}
                  data-turns={((t.turns % 4) + 4) % 4}
                  aria-label={`${t.kind} track, row ${y + 1}, column ${x + 1}${isLocked ? ", locked" : ""}`}
                >
                  <span className="track-art absolute inset-1" style={{ transform: `rotate(${t.turns * 90}deg)` }}>
                    <TrackArt kind={t.kind} />
                  </span>
                  {isLocked && <LockSimple weight="fill" size={20} className="absolute top-1 right-1 text-grass" aria-hidden />}
                </button>
              );
            }),
          )}

          {driving && <TrainRide route={path.cells} tile={tile} size={size} endRow={puzzle.board.endRow} onArrive={onSolved} />}
        </div>
      )}
    </div>
  );
}

/** Where the train should be, in px within the grid, for each step of its journey. */
function waypoints(route: ReturnType<typeof trace>["cells"], tile: number, size: number, endRow: number) {
  const cellOrigin = (p: Pos) => ({ x: (tile * 1.2 + GAP) + p.x * (tile + GAP), y: p.y * (tile + GAP) });
  const side = (p: Pos, s: number) => {
    const o = cellOrigin(p);
    const h = tile / 2;
    return s === N ? { x: o.x + h, y: o.y } : s === S ? { x: o.x + h, y: o.y + tile } : s === E ? { x: o.x + tile, y: o.y + h } : { x: o.x, y: o.y + h };
  };
  const points: { x: number; y: number }[] = [{ x: tile * 0.6, y: route[0].y * (tile + GAP) + tile / 2 }];
  for (const cell of route) {
    const a = side(cell, cell.entry);
    const b = side(cell, cell.exit);
    const o = cellOrigin(cell);
    const centre = { x: o.x + tile / 2, y: o.y + tile / 2 };
    points.push(a);
    if (cell.entry === opposite(cell.exit)) {
      points.push(centre);
    } else {
      // A curve is a quarter circle (radius tile/2) about the corner between its two sides.
      // Its middle lies on the corner-to-centre line, 1/√2 of the way along.
      const corner = { x: a.x + b.x - centre.x, y: a.y + b.y - centre.y };
      points.push({ x: corner.x + (centre.x - corner.x) * Math.SQRT1_2, y: corner.y + (centre.y - corner.y) * Math.SQRT1_2 });
    }
    points.push(b);
  }
  const last = cellOrigin({ x: size, y: endRow });
  points.push({ x: last.x + tile * 0.6, y: last.y + tile / 2 });
  return points;
}

function TrainRide({ route, tile, size, endRow, onArrive }: { route: ReturnType<typeof trace>["cells"]; tile: number; size: number; endRow: number; onArrive: () => void }) {
  const points = waypoints(route, tile, size, endRow);
  const token = tile * 0.7;
  return (
    <motion.div
      className="plastic plastic-tomato is-round pointer-events-none absolute top-0 left-0 z-10 grid place-items-center"
      style={{ width: token, height: token, marginLeft: -token / 2, marginTop: -token / 2 }}
      initial={{ x: points[0].x, y: points[0].y }}
      animate={{ x: points.map((p) => p.x), y: points.map((p) => p.y) }}
      transition={{ duration: rideSeconds(route.length), ease: "linear" }}
      onAnimationComplete={() => {
        toot();
        setTimeout(onArrive, 500);
      }}
      aria-hidden
    >
      <Train weight="fill" size={token * 0.62} />
    </motion.div>
  );
}
