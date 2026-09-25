"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Hunt } from "@/lib/schema";

export type SaveStatus =
  | { kind: "saved" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "error"; message: string; problems?: string[] };

const DEBOUNCE_MS = 700;

/**
 * Saves the hunt a moment after each edit. `flush()` saves immediately and
 * resolves once the server has the latest version, for actions like "Test
 * station" that must not run against a stale copy.
 */
export function useAutosave(hunt: Hunt) {
  const [status, setStatus] = useState<SaveStatus>({ kind: "saved" });
  const latest = useRef(hunt);
  const lastSavedJson = useRef(JSON.stringify(hunt));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);

  const save = useCallback(async (): Promise<boolean> => {
    const snapshot = latest.current;
    const json = JSON.stringify(snapshot);
    if (json === lastSavedJson.current) {
      setStatus({ kind: "saved" });
      return true;
    }
    setStatus({ kind: "saving" });
    try {
      const res = await fetch(`/api/setup/hunts/${snapshot.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: json,
      });
      const data = (await res.json().catch(() => ({}))) as { hunt?: Hunt; error?: string; problems?: string[] };
      if (!res.ok || !data.hunt) {
        setStatus({ kind: "error", message: data.error ?? "Couldn't save. Check your connection.", problems: data.problems });
        return false;
      }
      lastSavedJson.current = json;
      setStatus(JSON.stringify(latest.current) === json ? { kind: "saved" } : { kind: "pending" });
      return true;
    } catch (error) {
      console.error("[setup] autosave failed", error);
      setStatus({ kind: "error", message: "Couldn't save. Check your connection." });
      return false;
    }
  }, []);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current) await inFlight.current;
    inFlight.current = save();
    const ok = await inFlight.current;
    inFlight.current = null;
    return ok;
  }, [save]);

  useEffect(() => {
    latest.current = hunt;
    if (JSON.stringify(hunt) === lastSavedJson.current) return;
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
      if (JSON.stringify(latest.current) !== lastSavedJson.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return { status, flush };
}
