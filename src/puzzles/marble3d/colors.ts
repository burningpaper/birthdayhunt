import type { PieceType } from "./track";

/** Each piece type's plastic (DESIGN.md colours). Its own file so tray icons don't pull in three.js. */
export const PIECE_COLORS: Record<PieceType, string> = {
  straight: "#FF8A1F",
  curve: "#F0508F",
  loop: "#FFC21A",
};
export const FIXED_COLOR = "#8FD3FF";
