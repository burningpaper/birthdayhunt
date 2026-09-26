"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { reveal as revealSound, snap as snapSound, tock } from "@/lib/audio/sfx";
import { hashSeed } from "../random";
import { fullImageRect, zoomOutFrom, type Crop } from "./crop";
import type { PuzzleProps } from "../types";
import { useElementSize } from "../useElementSize";
import {
  computeLayout,
  gridFor,
  homeOf,
  isOverBoard,
  makeTabs,
  pieceSides,
  piecePath,
  scatter,
  seededRng,
  shouldSnap,
  type Layout,
  type PieceCount,
} from "./logic";

type Move = { nx: number; ny: number; turns: number; placed: boolean };
type Piece = { id: number; col: number; row: number; path: string } & Move;

const TAP_SLOP = 8;
const HINT_MS = 2500;
const SOLVED_PAUSE_MS = 700;
/** Close-up finish: settle (500ms), pull back to the whole photo (2200ms), let it land (1000ms). */
const ZOOM_DELAY_MS = 500;
const ZOOM_MS = 2200;
const ZOOM_REVEAL_TOTAL_MS = ZOOM_DELAY_MS + ZOOM_MS + 1000;

/**
 * Picture Jigsaw (spec §6.1). The clue photo is cut into tabbed pieces and
 * tipped out around the board. Drag a piece near its spot, the right way up,
 * and it clicks in. Finishing the picture reveals the next hiding place.
 */
export function Jigsaw({ config, difficulty, cluePhotoUrl, onSolved, onAttemptFailed, onProgress, hintRequest }: PuzzleProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const [aspect, setAspect] = useState<number | null>(null);

  if (config.type !== "jigsaw") return null;
  if (!cluePhotoUrl) {
    return (
      <div className="grid min-h-full place-items-center p-8 text-center">
        <div className="grid justify-items-center gap-6">
          <p className="max-w-[30ch] text-2xl font-semibold text-cream/80">This jigsaw needs a clue photo. Add one in Setup.</p>
          <PlasticButton size="lg" color="tomato" onClick={onSolved}>Skip for now</PlasticButton>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative h-full w-full">
      {/* Loads the photo once to learn its shape; the board is cut to match. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cluePhotoUrl} alt="" hidden onLoad={(e) => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
      {size && aspect ? (
        <Board
          photoUrl={cluePhotoUrl}
          aspect={aspect}
          width={size.width}
          height={size.height}
          pieces={config.pieces}
          rotation={config.rotation}
          crop={config.crop}
          ghost={difficulty === "easy"}
          hintRequest={hintRequest}
          onSolved={onSolved}
          onAttemptFailed={onAttemptFailed}
          onProgress={onProgress}
        />
      ) : (
        <div className="absolute top-1/2 left-1/2 aspect-[4/3] w-1/2 -translate-1/2 animate-pulse rounded-[var(--radius-panel)] bg-cream/8" aria-label="Getting the puzzle ready" />
      )}
    </div>
  );
}

type BoardProps = {
  photoUrl: string;
  aspect: number;
  width: number;
  height: number;
  pieces: PieceCount;
  rotation: boolean;
  ghost: boolean;
  /** A mystery close-up to build instead of the whole photo. */
  crop?: Crop;
  hintRequest: number;
  onSolved: () => void;
  onAttemptFailed?: () => void;
  onProgress?: () => void;
};

function Board({ photoUrl, aspect, width, height, pieces: pieceCount, rotation, crop, ghost, hintRequest, onSolved, onAttemptFailed, onProgress }: BoardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { cols, rows } = gridFor(pieceCount, aspect);
  const layout: Layout = useMemo(() => computeLayout(width, height, aspect, cols, rows), [width, height, aspect, cols, rows]);
  const seed = hashSeed(`${photoUrl}:${pieceCount}:${crop ? `${crop.x},${crop.y},${crop.size}` : "whole"}`);

  // Everything about the starting layout derives from the seed, so it needs no state.
  const start = useMemo(() => {
    const rng = seededRng(seed);
    const tabs = makeTabs(cols, rows, rng);
    const spots = scatter(layout, cols * rows, rng);
    return Array.from({ length: cols * rows }, (_, id) => {
      const col = id % cols;
      const row = Math.floor(id / cols);
      return {
        id,
        col,
        row,
        sides: pieceSides(col, row, tabs),
        nx: spots[id].x / width,
        ny: spots[id].y / height,
        turns: rotation ? 1 + Math.floor(rng() * 3) : 0,
      };
    });
  }, [seed, cols, rows, layout, width, height, rotation]);

  const [moves, setMoves] = useState<Record<number, Move>>({});
  const [order, setOrder] = useState<number[]>(() => start.map((p) => p.id));
  const [hiddenHint, setHiddenHint] = useState(0);
  const [solved, setSolved] = useState(false);
  const drag = useRef<{ id: number; startX: number; startY: number; originX: number; originY: number; moved: boolean; el: SVGGElement } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const pieces: Piece[] = start.map((p) => {
    const move = moves[p.id] ?? { nx: p.nx, ny: p.ny, turns: p.turns, placed: false };
    return { id: p.id, col: p.col, row: p.row, path: piecePath(layout.cellW, layout.cellH, p.sides, layout.depth), ...move };
  });
  const placedCount = pieces.filter((p) => p.placed).length;

  // A hint shows until its timer runs out (spec: flash one unplaced piece's target outline).
  useEffect(() => {
    if (hintRequest === 0) return;
    const timer = setTimeout(() => setHiddenHint(hintRequest), HINT_MS);
    return () => clearTimeout(timer);
  }, [hintRequest]);
  const unplaced = pieces.filter((p) => !p.placed);
  const hintPiece = hintRequest > hiddenHint && unplaced.length > 0 ? unplaced[hintRequest % unplaced.length] : null;

  const commit = (id: number, move: Move) => setMoves((m) => ({ ...m, [id]: move }));

  function onPointerDown(event: ReactPointerEvent<SVGGElement>, piece: Piece) {
    if (piece.placed || solved || drag.current) return;
    // Capture on the board, not the piece: bringing the piece to the top moves
    // its DOM node, and moving a node silently drops its pointer capture.
    svgRef.current?.setPointerCapture(event.pointerId);
    drag.current = {
      id: piece.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: piece.nx * width,
      originY: piece.ny * height,
      moved: false,
      el: event.currentTarget,
    };
    event.currentTarget.style.transition = "none";
    setOrder((o) => [...o.filter((id) => id !== piece.id), piece.id]);
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    d.moved = true;
    d.el.style.transform = `translate(${d.originX + dx}px, ${d.originY + dy}px)`;
    d.el.classList.add("is-lifted");
  }

  function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    // Always the piece being dragged, whatever the finger is over now.
    const piece = pieces.find((p) => p.id === d.id)!;
    d.el.style.transition = "";
    d.el.classList.remove("is-lifted");

    if (!d.moved) {
      if (rotation) {
        tock();
        commit(piece.id, { nx: piece.nx, ny: piece.ny, turns: piece.turns + 1, placed: false });
      }
      return;
    }

    const pos = {
      x: Math.min(Math.max(d.originX + event.clientX - d.startX, -layout.depth), width - layout.cellW),
      y: Math.min(Math.max(d.originY + event.clientY - d.startY, -layout.depth), height - layout.cellH),
    };
    const home = homeOf(layout, piece.col, piece.row);

    if (shouldSnap(pos, home, piece.turns)) {
      snapSound();
      commit(piece.id, { nx: home.x / width, ny: home.y / height, turns: 0, placed: true });
      onProgress?.();
      if (placedCount + 1 === pieces.length) {
        setSolved(true);
        setTimeout(onSolved, crop ? ZOOM_REVEAL_TOTAL_MS : SOLVED_PAUSE_MS);
      }
      return;
    }
    if (isOverBoard(pos, layout)) onAttemptFailed?.();
    commit(piece.id, { nx: pos.x / width, ny: pos.y / height, turns: piece.turns, placed: false });
  }

  // Placed pieces sit underneath; the rest stack in the order they were touched.
  const drawOrder = [...pieces].sort((a, b) => Number(b.placed) - Number(a.placed) || order.indexOf(a.id) - order.indexOf(b.id));
  const { board } = layout;
  // Where the whole photo is drawn so the close-up (if any) exactly fills the board.
  const photo = fullImageRect(board, crop);

  return (
    <svg
      ref={svgRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      width={width}
      height={height}
      data-cell={`${layout.cellW},${layout.cellH}`} className="jigsaw absolute inset-0 touch-none select-none" role="img" aria-label={`Jigsaw puzzle, ${placedCount} of ${pieces.length} pieces placed`}>
      <defs>
        <clipPath id={`${uid}-board`}>
          <rect x={board.x} y={board.y} width={board.w} height={board.h} />
        </clipPath>
        <filter id={`${uid}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#080e24" floodOpacity="0.55" />
        </filter>
        {pieces.map((p) => (
          <clipPath key={p.id} id={`${uid}-clip-${p.id}`}>
            <path d={p.path} />
          </clipPath>
        ))}
      </defs>

      {/* The tray the picture is built in. */}
      <rect x={board.x - 6} y={board.y - 6} width={board.w + 12} height={board.h + 12} rx={18} className="fill-toybox-glow/60 stroke-cream/25" strokeWidth={2} strokeDasharray="10 8" />
      {ghost && (
        <g clipPath={`url(#${uid}-board)`}>
          <image href={photoUrl} x={photo.x} y={photo.y} width={photo.w} height={photo.h} preserveAspectRatio="none" opacity={0.22} />
        </g>
      )}

      {drawOrder.map((p) => (
        <g
          key={p.id}
          data-piece={p.id}
          data-placed={p.placed}
          data-turns={p.turns % 4}
          data-home={`${homeOf(layout, p.col, p.row).x},${homeOf(layout, p.col, p.row).y}`}
          className={`jigsaw-piece ${p.placed ? "is-placed" : ""}`}
          style={{ transform: `translate(${p.nx * width}px, ${p.ny * height}px)` }}
          filter={p.placed ? undefined : `url(#${uid}-shadow)`}
          onPointerDown={(e) => onPointerDown(e, p)}
        >
          {/* Rotate about the cell's centre. (Not fill-box: a group's box includes the whole unclipped photo.) */}
          <g className="jigsaw-turn" style={{ transform: `rotate(${p.turns * 90}deg)`, transformOrigin: `${layout.cellW / 2}px ${layout.cellH / 2}px` }}>
            <g clipPath={`url(#${uid}-clip-${p.id})`}>
              <image
                href={photoUrl}
                x={photo.x - board.x - p.col * layout.cellW}
                y={photo.y - board.y - p.row * layout.cellH}
                width={photo.w}
                height={photo.h}
                preserveAspectRatio="none"
              />
            </g>
            {!solved && <path d={p.path} fill="none" stroke={p.placed ? "rgb(255 255 255 / 0.18)" : "rgb(255 255 255 / 0.6)"} strokeWidth={p.placed ? 1 : 2} />}
          </g>
        </g>
      ))}

      {/* Finished: the whole photo fades in over the pieces, hiding the seams. */}
      {/* Finished: the seamless photo fades in over the pieces; a close-up then pulls back to the whole photo. */}
      {solved && <FinishedPicture photoUrl={photoUrl} board={board} crop={crop} clipId={`${uid}-board`} />}

      {hintPiece && (
        <path
          d={hintPiece.path}
          transform={`translate(${homeOf(layout, hintPiece.col, hintPiece.row).x} ${homeOf(layout, hintPiece.col, hintPiece.row).y})`}
          className="jigsaw-hint"
          fill="rgb(255 194 26 / 0.18)"
          stroke="#FFC21A"
          strokeWidth={4}
        />
      )}
    </svg>
  );
}

/**
 * The completed picture. With a close-up, the whole photo is drawn at board
 * size and starts blown up so only the close-up shows (looking exactly like
 * the finished pieces), then animates back to full size: the zoom-out reveal.
 */
function FinishedPicture({ photoUrl, board, crop, clipId }: { photoUrl: string; board: Layout["board"]; crop?: Crop; clipId: string }) {
  const zoom = useRef<SVGGElement>(null);
  const start = zoomOutFrom(board, crop);
  const startTransform = `translate(${start.translateX}px, ${start.translateY}px) scale(${start.scale})`;

  useEffect(() => {
    const element = zoom.current;
    if (!crop || !element) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const soundTimer = setTimeout(revealSound, ZOOM_DELAY_MS);
    const animation = element.animate([{ transform: startTransform }, { transform: "translate(0px, 0px) scale(1)" }], {
      delay: ZOOM_DELAY_MS,
      duration: reduceMotion ? 1 : ZOOM_MS,
      easing: "cubic-bezier(0.45, 0, 0.2, 1)", // slow start, slow landing: a pull-back, not a snap
      fill: "forwards",
    });
    return () => {
      clearTimeout(soundTimer);
      animation.cancel();
    };
  }, [crop, startTransform]);

  return (
    <g clipPath={`url(#${clipId})`} className="jigsaw-complete" data-reveal={crop ? "zoom" : "fade"}>
      <g ref={zoom} style={{ transformBox: "view-box", transformOrigin: "0 0", transform: crop ? startTransform : undefined }}>
        <image href={photoUrl} x={board.x} y={board.y} width={board.w} height={board.h} preserveAspectRatio="none" />
      </g>
    </g>
  );
}
