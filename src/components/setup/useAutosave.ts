"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Hunt } from "@/lib/schema";

export type SaveStatus =
  | { kind: "saved" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "error"; message: string; problems?: string[] }
  /** Someone else saved this hunt since we loaded it. We stop saving rather than overwrite them. */
  | { kind: "conflict" };

const DEBOUNCE_MS = 700;

/** What counts as "the parent changed something": everything except the server's revision counter. */
function contentOf(hunt: Hunt): string {
  return JSON.stringify({ ...hunt, revision: 0 });
}

/**
 * Saves the hunt a moment after each edit, based on the revision this copy
 * was loaded at. If the server has moved on (another tab, another device),
 * the save is refused with 409 and we switch to "conflict" instead of
 * overwriting their work. `flush()` saves immediately; `adopt()` takes a
 * fresh server copy as the new baseline.
 */
export function useAutosave(hunt: Hunt) {
  const [status, setStatus] = useState<SaveStatus>({ kind: "saved" });
  const latest = useRef(hunt);
  const lastSaved = useRef(contentOf(hunt));
  const baseRevision = useRef(hunt.revision);
  const conflicted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);

  const markConflict = useCallback(() => {
    conflicted.current = true;
    if (timer.current) clearTimeout(timer.current);
    setStatus({ kind: "conflict" });
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (conflicted.current) return false;
    const snapshot = latest.current;
    const content = contentOf(snapshot);
    if (content === lastSaved.current) {
      setStatus({ kind: "saved" });
      return true;
    }
    setStatus({ kind: "saving" });
    try {
      const res = await fetch(`/api/setup/hunts/${snapshot.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...snapshot, revision: baseRevision.current }),
      });
      const data = (await res.json().catch(() => ({}))) as { hunt?: Hunt; error?: string; problems?: string[] };
      if (res.status === 409) {
        console.warn("[setup] save refused: this hunt changed elsewhere");
        markConflict();
        return false;
      }
      if (!res.ok || !data.hunt) {
        setStatus({ kind: "error", message: data.error ?? "Couldn't save. Check your connection.", problems: data.problems });
        return false;
      }
      lastSaved.current = content;
      baseRevision.current = data.hunt.revision;
      setStatus(contentOf(latest.current) === content ? { kind: "saved" } : { kind: "pending" });
      return true;
    } catch (error) {
      console.error("[setup] autosave failed", error);
      setStatus({ kind: "error", message: "Couldn't save. Check your connection." });
      return false;
    }
  }, [markConflict]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current) await inFlight.current;
    inFlight.current = save();
    const ok = await inFlight.current;
    inFlight.current = null;
    return ok;
  }, [save]);

  /** Take a server copy as the new baseline (the caller also puts it on screen). */
  const adopt = useCallback((server: Hunt) => {
    if (timer.current) clearTimeout(timer.current);
    latest.current = server;
    lastSaved.current = contentOf(server);
    baseRevision.current = server.revision;
    conflicted.current = false;
    setStatus({ kind: "saved" });
  }, []);

  const hasUnsavedChanges = useCallback(
    () => inFlight.current !== null || contentOf(latest.current) !== lastSaved.current,
    [],
  );
  const currentRevision = useCallback(() => baseRevision.current, []);

  useEffect(() => {
    latest.current = hunt;
    if (conflicted.current || contentOf(hunt) === lastSaved.current) return;
    setStatus({ kind: "pending" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hunt, flush]);

  // Don't lose an edit made in the last split second before closing the tab.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (contentOf(latest.current) !== lastSaved.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return { status, flush, adopt, markConflict, hasUnsavedChanges, currentRevision };
}
