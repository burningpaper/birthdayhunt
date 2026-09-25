"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { tock } from "@/lib/audio/sfx";
import type { PlasticColor } from "@/lib/puzzleMeta";

type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, string> = {
  sm: "min-h-12 px-5 text-lg",
  md: "min-h-14 px-7 text-2xl",
  lg: "min-h-20 px-10 text-4xl",
  xl: "min-h-28 px-14 text-6xl",
};

const ROUND_SIZES: Record<Size, string> = {
  sm: "size-12",
  md: "size-16",
  lg: "size-20",
  xl: "size-28",
};

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> & {
  color?: PlasticColor;
  size?: Size;
  /** A circular icon button (speaker, dial arrows). Needs an aria-label. */
  round?: boolean;
  /** Play the plastic click on press. On by default. */
  clicky?: boolean;
  children: ReactNode;
};

/**
 * A button made of shiny plastic (see DESIGN.md, "The plastic recipe").
 * It sinks on press and makes a hollow click, so it feels like a real toy.
 */
export function PlasticButton({
  color = "cobalt",
  size = "md",
  round = false,
  clicky = true,
  className = "",
  onPointerDown,
  children,
  ...rest
}: Props) {
  const shape = round
    ? `is-round grid place-items-center ${ROUND_SIZES[size]}`
    : `inline-flex items-center justify-center gap-3 whitespace-nowrap ${SIZES[size]}`;

  return (
    <button
      type="button"
      className={`plastic plastic-${color} is-pressable font-display leading-none tracking-wide ${shape} ${className}`}
      onPointerDown={(event) => {
        if (clicky) tock();
        onPointerDown?.(event);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
