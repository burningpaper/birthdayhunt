"use client";

import { SpeakerHigh } from "@phosphor-icons/react";
import type { PlasticColor } from "@/lib/puzzleMeta";
import { PlasticButton } from "./PlasticButton";

type Props = {
  onSpeak: () => void;
  color?: PlasticColor;
  size?: "md" | "lg" | "xl";
  label?: string;
};

/** The round "hear it again" button that sits beside every spoken line. */
export function SpeakerButton({ onSpeak, color = "cream", size = "md", label = "Say it again" }: Props) {
  const iconSize = size === "xl" ? 60 : size === "lg" ? 40 : 32;
  return (
    <PlasticButton round size={size} color={color} aria-label={label} onClick={onSpeak}>
      <SpeakerHigh weight="fill" size={iconSize} />
    </PlasticButton>
  );
}
