import type { Kind } from "./logic";

/**
 * The rails drawn on a tile, in its unrotated orientation (straight: north to
 * south; curve: north to east). The tile rotates the whole drawing.
 */

const WOOD = "#B9824F";
const STEEL = "#4E5A73";

function StraightRails({ vertical = true }: { vertical?: boolean }) {
  const sleepers = [8, 22, 36, 50, 64, 78, 92];
  return (
    <g transform={vertical ? undefined : "rotate(90 50 50)"}>
      {sleepers.map((y) => (
        <rect key={y} x={22} y={y - 3.5} width={56} height={7} rx={2} fill={WOOD} />
      ))}
      <line x1={36} y1={0} x2={36} y2={100} stroke={STEEL} strokeWidth={6} />
      <line x1={64} y1={0} x2={64} y2={100} stroke={STEEL} strokeWidth={6} />
    </g>
  );
}

function CurveRails() {
  // Centred on the north-east corner (100, 0): the track sweeps from the top edge to the right edge.
  const angles = [98, 111, 124, 137, 150, 163, 176];
  const at = (r: number, deg: number) => [100 + r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
  return (
    <g>
      {angles.map((deg) => {
        const [x1, y1] = at(22, deg);
        const [x2, y2] = at(78, deg);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={WOOD} strokeWidth={7} strokeLinecap="round" />;
      })}
      <path d="M64 0 A36 36 0 0 0 100 36" fill="none" stroke={STEEL} strokeWidth={6} />
      <path d="M36 0 A64 64 0 0 0 100 64" fill="none" stroke={STEEL} strokeWidth={6} />
    </g>
  );
}

export function TrackArt({ kind }: { kind: Kind }) {
  return (
    <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
      {kind === "straight" && <StraightRails />}
      {kind === "curve" && <CurveRails />}
      {kind === "cross" && (
        <>
          <StraightRails vertical={false} />
          <StraightRails />
        </>
      )}
    </svg>
  );
}
