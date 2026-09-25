"use client";

/* eslint-disable @next/next/no-img-element -- previews of uploaded media */
import { Camera, ImageSquare, Trash } from "@phosphor-icons/react";
import { useId, useRef, useState } from "react";
import { resizePhoto, uploadMedia, type MediaMode } from "@/lib/uploadClient";
import { QuietButton } from "./ui";

type Props = {
  url?: string;
  mediaMode: MediaMode;
  onChange: (url: string | undefined) => void;
};

/**
 * Take a photo with the iPad camera, or pick one. Two separate inputs,
 * because `capture` sends iOS straight to the camera with no library option.
 */
export function CluePhotoField({ url, mediaMode, onChange }: Props) {
  const id = useId();
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await resizePhoto(file);
      onChange(await uploadMedia(photo, `clue-${Date.now()}.jpg`, mediaMode));
    } catch (err) {
      console.error("[setup] photo upload failed", err);
      setError(err instanceof Error ? err.message : "That photo didn't upload. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid aspect-[4/3] w-44 place-items-center overflow-hidden rounded-[var(--radius-tile)] bg-ink/6">
          {busy ? (
            <span className="h-full w-full animate-pulse bg-ink/10" aria-label="Uploading photo" />
          ) : url ? (
            <img src={url} alt="Clue photo" className="size-full object-cover" />
          ) : (
            <ImageSquare size={40} className="text-ink/30" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <QuietButton disabled={busy} onClick={() => cameraInput.current?.click()}>
            <Camera weight="fill" size={20} />
            Take photo
          </QuietButton>
          <QuietButton disabled={busy} onClick={() => libraryInput.current?.click()}>
            <ImageSquare weight="fill" size={20} />
            Choose photo
          </QuietButton>
          {url && (
            <QuietButton tone="danger" disabled={busy} onClick={() => onChange(undefined)} aria-label="Remove clue photo">
              <Trash weight="bold" size={18} />
            </QuietButton>
          )}
        </div>
      </div>
      <input ref={cameraInput} id={`${id}-camera`} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={libraryInput} id={`${id}-library`} type="file" accept="image/*" hidden onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
      {error && <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p>}
    </div>
  );
}
