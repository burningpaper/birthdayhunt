"use client";

import { useCallback, useEffect, useState } from "react";
import type { Hunt, Progress } from "@/lib/schema";

const POLL_MS = 10_000;

type Autosave = {
  adopt: (server: Hunt) => void;
  markConflict: () => void;
  hasUnsavedChanges: () => boolean;
  currentRevision: () => number;
};

/**
 * Keeps an open editor in step with the server. It checks when the editor
 * opens (including when the Back button restores an old copy of the page),
 * whenever the tab comes back into view, and every 10 seconds.
 *
 * If the server has a newer hunt and nothing here is unsaved, the newer
 * version quietly replaces what's on screen. If something here IS unsaved,
 * that's a real conflict: we say so rather than pick a winner.
 * The same request brings the child's progress for the live view.
 */
export function useHuntSync(huntId: string, initialProgress: Progress, autosave: Autosave, onNewer: (hunt: Hunt) => void) {
  const [progress, setProgress] = useState(initialProgress);

  const check = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const res = await fetch(`/api/setup/hunts/${huntId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { hunt: Hunt; progress: Progress };
      setProgress(data.progress);
      if (data.hunt.revision === autosave.currentRevision()) return;
      if (autosave.hasUnsavedChanges()) {
        autosave.markConflict();
        return;
      }
      autosave.adopt(data.hunt);
      onNewer(data.hunt);
    } catch (error) {
      console.warn("[setup] couldn't check for a newer version", error);
    }
  }, [huntId, autosave, onNewer]);

  useEffect(() => {
    const onVisible = () => void check();
    const first = setTimeout(onVisible, 0); // right away, including a page restored by Back
    const timer = setInterval(onVisible, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [check]);

  return { progress, setProgress };
}
