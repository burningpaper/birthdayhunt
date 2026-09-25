"use client";

/* eslint-disable @next/next/no-img-element -- previews of uploaded card photos */
import { Plus, X } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { resizePhoto, uploadMedia, type MediaMode } from "@/lib/uploadClient";
import { QuietButton } from "./ui";

const MAX_PHOTOS = 8;
const CARD_PHOTO_EDGE = 800; // cards are small; this keeps uploads light

type Props = { urls: string[]; mediaMode: MediaMode; onChange: (urls: string[]) => void };

/**
 * Up to 8 photos for Memory Match card faces: pets, family, things around
 * the house. Any pairs beyond the photos use the built-in pictures.
 */
export function CardPhotosField({ urls, mediaMode, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const room = MAX_PHOTOS - urls.length;

  async function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files).slice(0, room);
    setError(null);
    setUploading(chosen.length);
    const added: string[] = [];
    for (const file of chosen) {
      try {
        const photo = await resizePhoto(file, CARD_PHOTO_EDGE);
        added.push(await uploadMedia(photo, `card-${Date.now()}.jpg`, mediaMode));
      } catch (err) {
        console.error("[setup] card photo upload failed", err);
        setError("Some photos didn't upload. Try those again.");
      }
      setUploading((n) => n - 1);
    }
    onChange([...urls, ...added]);
  }

  return (
    <div className="grid gap-3">
      <div>
        <span className="text-sm font-bold text-ink">Card photos (optional)</span>
        <p className="text-sm text-ink/65">Up to {MAX_PHOTOS}. Pets, family and things around the house make great cards. Built-in pictures fill any gaps.</p>
      </div>
      <ul className="flex flex-wrap gap-3">
        {urls.map((url, i) => (
          <li key={url} className="relative">
            <img src={url} alt={`Card photo ${i + 1}`} className="size-20 rounded-[var(--radius-tile)] object-cover" />
            <button
              type="button"
              onClick={() => onChange(urls.filter((u) => u !== url))}
              aria-label={`Remove card photo ${i + 1}`}
              className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-ink text-white shadow focus-visible:outline-3 focus-visible:outline-cobalt"
            >
              <X weight="bold" size={14} />
            </button>
          </li>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <li key={`up-${i}`} className="size-20 animate-pulse rounded-[var(--radius-tile)] bg-ink/10" aria-label="Uploading photo" />
        ))}
      </ul>
      {room > 0 && (
        <div>
          <QuietButton onClick={() => input.current?.click()} disabled={uploading > 0}>
            <Plus weight="bold" size={18} />
            Add card photos
          </QuietButton>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
        </div>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p>}
    </div>
  );
}
