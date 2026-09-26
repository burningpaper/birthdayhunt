"use client";

import { CaretDown, CheckCircle, SpeakerSlash } from "@phosphor-icons/react";
import type { MediaMode } from "@/lib/uploadClient";
import { VOICE_LINES, type VoiceLineId, type VoiceLines } from "@/lib/voiceLines";
import { Panel } from "./ui";
import { VoiceRecorder } from "./VoiceRecorder";

type Props = { lines: VoiceLines | undefined; mediaMode: MediaMode; onChange: (lines: VoiceLines) => void };

/**
 * The hunt's voice lines: every sentence the app says out loud, each with
 * its own upload or recording. A line with neither stays silent (the words
 * still show on screen), so nothing here is required.
 */
export function VoiceLinesPanel({ lines = {}, mediaMode, onChange }: Props) {
  const recorded = VOICE_LINES.filter((l) => lines[l.id]).length;
  const groups = [...new Set(VOICE_LINES.map((l) => l.group))];

  const set = (id: VoiceLineId, url: string | undefined) => {
    const next = { ...lines };
    if (url) next[id] = url;
    else delete next[id];
    onChange(next);
  };

  return (
    <Panel className="p-0">
      <details className="group" data-testid="voice-lines">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-panel)] p-6 focus-visible:outline-3 focus-visible:outline-cobalt [&::-webkit-details-marker]:hidden">
          <div className="grid gap-1">
            <h2 className="font-display text-3xl text-ink">Voice lines</h2>
            <p className="text-base text-ink/65">
              What the app says out loud, in your voice. Upload an audio file or record each one. Lines without one stay silent.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="rounded-full bg-paper px-3 py-1 text-base font-semibold text-ink" aria-live="polite">
              {recorded} of {VOICE_LINES.length} added
            </span>
            <CaretDown weight="bold" size={22} className="text-ink/60 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </div>
        </summary>

        <div className="grid gap-8 px-6 pb-6">
          {groups.map((group) => (
            <section key={group} className="grid gap-3">
              <h3 className="text-sm font-bold tracking-wide text-ink/55 uppercase">{group}</h3>
              <ul className="grid gap-3">
                {VOICE_LINES.filter((l) => l.group === group).map((line) => (
                  <li key={line.id} className="grid gap-3 rounded-[var(--radius-tile)] border border-ink/10 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" data-voice-line={line.id}>
                    <div className="grid gap-1">
                      <p className="flex items-start gap-2 text-lg font-semibold text-ink">
                        {lines[line.id] ? (
                          <CheckCircle weight="fill" size={22} className="mt-0.5 shrink-0 text-grass" aria-label="Added" />
                        ) : (
                          <SpeakerSlash weight="fill" size={22} className="mt-0.5 shrink-0 text-ink/35" aria-label="Silent" />
                        )}
                        “{line.words}”
                      </p>
                      <p className="pl-8 text-sm text-ink/60">{line.when}</p>
                    </div>
                    <VoiceRecorder url={lines[line.id]} mediaMode={mediaMode} noun="line" maxSeconds={20} emphasis="quiet" onChange={(url) => set(line.id, url)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </details>
    </Panel>
  );
}
