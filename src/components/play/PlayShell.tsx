import type { ReactNode } from "react";
import { RotateOverlay } from "./RotateOverlay";

/**
 * The full-screen toybox every play screen sits in. Fixed to the viewport
 * so nothing scrolls or bounces while a seven-year-old is dragging things.
 */
export function PlayShell({ children }: { children: ReactNode }) {
  return (
    <main className="toybox play-surface fixed inset-0 overflow-hidden">
      {children}
      <RotateOverlay />
    </main>
  );
}
