"use client";

import { DeviceRotate } from "@phosphor-icons/react";

/** Play is landscape-only. In portrait, cover everything with a friendly nudge. */
export function RotateOverlay() {
  return (
    <div className="toybox fixed inset-0 z-40 hidden place-items-center p-8 text-center portrait:grid" role="alert">
      <div className="grid justify-items-center gap-6">
        <div className="plastic plastic-sunflower is-round grid size-36 place-items-center">
          <DeviceRotate weight="fill" size={84} className="animate-[spin_2.4s_ease-in-out_infinite] motion-reduce:animate-none" />
        </div>
        <p className="font-display text-5xl">Turn me sideways!</p>
      </div>
    </div>
  );
}
