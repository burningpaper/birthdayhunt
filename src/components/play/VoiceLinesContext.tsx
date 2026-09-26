"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { playRecording } from "@/lib/audio/voice";
import type { VoiceLineId, VoiceLines } from "@/lib/voiceLines";

/**
 * The hunt's recorded voice lines, for every screen and puzzle of a station
 * (including portalled ones, like the marble run's free build).
 */
const VoiceLinesContext = createContext<VoiceLines>({});

export function VoiceLinesProvider({ lines, children }: { lines: VoiceLines | undefined; children: ReactNode }) {
  return <VoiceLinesContext.Provider value={lines ?? {}}>{children}</VoiceLinesContext.Provider>;
}

/** `has(line)`: is there a recording to play? `say(line)`: play it, or say nothing if there isn't one. */
export function useVoiceLines() {
  const lines = useContext(VoiceLinesContext);
  return useMemo(
    () => ({
      has: (id: VoiceLineId) => Boolean(lines[id]),
      say: (id: VoiceLineId) => {
        const url = lines[id];
        if (url) void playRecording(url);
      },
    }),
    [lines],
  );
}
