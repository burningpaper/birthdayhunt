"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during server render and hydration, true afterwards. For browser-only values like local time. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
