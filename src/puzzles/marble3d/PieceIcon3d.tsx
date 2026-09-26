import { PIECE_COLORS } from "./Scene";
import { TUBE_RADIUS, piecePath, type PieceType } from "./track";

/** A tray icon: the piece's tube seen flat on, in its plastic colour. */
export function PieceIcon3d({ type, turns = 0, size }: { type: PieceType; turns?: number; size: number }) {
  const { points } = piecePath(type, turns);
  const d = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(3)},${(-p.y).toFixed(3)}`).join(" ");
  const color = PIECE_COLORS[type];
  const width = TUBE_RADIUS * 2;
  return (
    <svg viewBox="-0.62 -0.62 1.24 1.24" width={size} height={size} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={width * 0.22} strokeLinecap="round" strokeLinejoin="round" transform="translate(-0.03,-0.04)" />
      <path d={d} fill="none" stroke={color} strokeWidth={width * 0.3} strokeLinecap="round" strokeLinejoin="round" transform="translate(0,0.05)" />
    </svg>
  );
}
