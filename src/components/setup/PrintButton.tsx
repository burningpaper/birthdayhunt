"use client";

import { Printer } from "@phosphor-icons/react";
import { PlasticButton } from "@/components/plastic/PlasticButton";

export function PrintButton() {
  return (
    <PlasticButton color="cobalt" size="sm" clicky={false} onClick={() => window.print()}>
      <Printer weight="fill" size={22} />
      Print
    </PlasticButton>
  );
}
