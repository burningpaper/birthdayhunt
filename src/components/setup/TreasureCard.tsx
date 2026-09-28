"use client";

import { TreasureChest } from "@phosphor-icons/react";
import type { Hunt } from "@/lib/schema";
import type { MediaMode } from "@/lib/uploadClient";
import { Field, Panel, TextArea, TextInput } from "./ui";
import { VoiceRecorder } from "./VoiceRecorder";

type Props = { hunt: Hunt; mediaMode: MediaMode; onChange: (patch: Partial<Hunt>) => void };

/**
 * The treasure: the last hiding place, after every station. It has no code
 * and no puzzle (the last station's clue leads here), just the final gift,
 * the message shown with it, and the ending message played at the finish line.
 */
export function TreasureCard({ hunt, mediaMode, onChange }: Props) {
  const treasure = hunt.treasure ?? {};
  const setTreasure = (patch: Partial<NonNullable<Hunt["treasure"]>>) => onChange({ treasure: { ...treasure, ...patch } });
  const lastStation = hunt.stations.length;

  return (
    <Panel className="grid gap-5 border-2 border-sunflower/60">
      <header className="flex items-center gap-4">
        <span className="plastic plastic-sunflower is-tile grid size-12 shrink-0 place-items-center" aria-hidden>
          <TreasureChest weight="fill" size={30} />
        </span>
        <div className="grid gap-0.5">
          <h2 className="font-display text-3xl text-ink">The treasure</h2>
          <p className="text-base text-ink/65">
            No code or puzzle here: station {lastStation}&apos;s clue leads to it. When he finds it, he taps &ldquo;I found the treasure!&rdquo; for the finish line.
          </p>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Where you'll hide the final gift" hint="Only you see this: it's on your set-up checklist.">
          <TextInput value={treasure.hidingNote ?? ""} placeholder="In the wardrobe, behind the coats" maxLength={200} onChange={(e) => setTreasure({ hidingNote: e.target.value || undefined })} />
        </Field>
        <Field label="The final gift" hint="Only you see this, never the child.">
          <TextInput value={treasure.gift ?? ""} placeholder="The big red box" maxLength={200} onChange={(e) => setTreasure({ gift: e.target.value || undefined })} />
        </Field>
      </div>

      <Field label="Treasure message (optional)" hint="Shown with the last clue, and again at the finish line.">
        <TextArea value={hunt.treasureMessage ?? ""} maxLength={300} placeholder="Happy birthday! You cracked every puzzle." onChange={(e) => onChange({ treasureMessage: e.target.value || undefined })} />
      </Field>

      <Field label="Ending message (optional)" hint="Played at the finish line, when he taps “I found the treasure!”. Also listed under Voice lines.">
        <VoiceRecorder
          url={hunt.voiceLines?.["finale.found"]}
          mediaMode={mediaMode}
          noun="ending message"
          maxSeconds={60}
          onChange={(url) => {
            const lines = { ...hunt.voiceLines };
            if (url) lines["finale.found"] = url;
            else delete lines["finale.found"];
            onChange({ voiceLines: lines });
          }}
        />
      </Field>
    </Panel>
  );
}
