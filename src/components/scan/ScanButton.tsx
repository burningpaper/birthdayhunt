"use client";

import { Scan } from "@phosphor-icons/react";
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { useHydrated } from "@/components/useHydrated";
import type { PlasticColor } from "@/lib/puzzleMeta";
import { QrScanner } from "./QrScanner";

type Props = { label?: string; size?: "sm" | "md" | "lg" | "xl"; color?: PlasticColor };

/** A plastic button that opens the in-page scanner. */
export function ScanButton({ label = "Scan a code!", size = "lg", color = "cobalt" }: Props) {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated(); // document.body only exists in the browser
  const iconSize = { sm: 22, md: 28, lg: 40, xl: 56 }[size];
  return (
    <>
      <PlasticButton size={size} color={color} onClick={() => setOpen(true)}>
        <Scan weight="bold" size={iconSize} />
        {label}
      </PlasticButton>
      {/*
        Portalled to <body>: the button often sits inside an animated
        (transformed) container, which would trap a position:fixed overlay.
      */}
      {hydrated && createPortal(<AnimatePresence>{open && <QrScanner onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </>
  );
}
