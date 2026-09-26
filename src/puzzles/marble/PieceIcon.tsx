import { BOUNCER_RADIUS, pieceSegments, type PieceType } from "./pieces";
import { PIECE_COLORS } from "./render";

/**
 * A piece drawn as SVG. At true scale (`size` pixels for 200 world units) it
 * follows a finger during a drag; as a tray icon (`icon`) it's zoomed to
 * fill its tile, so a thin ramp or small bouncer is still easy to see.
 */
export function PieceIcon({ type, turns = 0, size, icon = false }: { type: PieceType; turns?: number; size: number; icon?: boolean }) {
  const color = PIECE_COLORS[type];
  const view = icon ? (type === "bouncer" ? "-34 -34 68 68" : "-92 -92 184 184") : "-100 -100 200 200";
  const stroke = icon ? 20 : 14;
  return (
    <svg viewBox={view} width={size} height={size} aria-hidden style={{ overflow: "visible" }}>
      {type === "bouncer" ? (
        <>
          <circle cx={0} cy={3} r={BOUNCER_RADIUS} fill={color.lip} />
          <circle cx={0} cy={0} r={BOUNCER_RADIUS} fill={color.base} />
          <circle cx={-7} cy={-8} r={6} fill="rgba(255,255,255,0.5)" />
        </>
      ) : (
        pieceSegments(type, { x: 0, y: 0 }, turns).map(([a, b], i) => (
          <g key={i} strokeLinecap="round">
            <line x1={a.x} y1={a.y + 3} x2={b.x} y2={b.y + 3} stroke={color.lip} strokeWidth={stroke} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color.base} strokeWidth={stroke} />
          </g>
        ))
      )}
    </svg>
  );
}
