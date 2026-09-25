"use client";

import { useEffect } from "react";

/**
 * iOS Safari ignores `user-scalable=no`, so a two-finger pinch would zoom the
 * page mid-puzzle. Safari's own gesture events can be cancelled, which stops
 * it. (Double-tap zoom is handled by `touch-action: manipulation` in CSS.)
 */
export function NoPinchZoom() {
  useEffect(() => {
    const block = (event: Event) => event.preventDefault();
    const names = ["gesturestart", "gesturechange", "gestureend"];
    names.forEach((name) => document.addEventListener(name, block, { passive: false }));
    return () => names.forEach((name) => document.removeEventListener(name, block));
  }, []);
  return null;
}
