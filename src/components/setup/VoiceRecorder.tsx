"use client";

import { ArrowCounterClockwise, Microphone, Play, Stop, Trash, UploadSimple } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { MAX_AUDIO_UPLOAD_BYTES, formatDuration, mightNotPlayOnIpad, pickRecordingMime, recordingExtension, uploadAudioType } from "@/lib/recording";
import { uploadMedia, type MediaMode } from "@/lib/uploadClient";
import { QuietButton } from "./ui";

type Props = {
  url?: string;
  mediaMode: MediaMode;
  onChange: (url: string | undefined) => void;
  /** What the parent is recording, for button labels: "voice clue", "question". */
  noun?: string;
  maxSeconds?: number;
  /** "primary" is a plastic button; "quiet" suits optional extras like lock questions. */
  emphasis?: "primary" | "quiet";
};

const FLUSH_GRACE_MS = 150;

type State =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "recording"; startedAt: number }
  | { kind: "uploading" };

/**
 * Record a clip with MediaRecorder, or upload an audio file (MP3, M4A, WAV,
 * AAC). Safari records audio/mp4, which is exactly what the child's iPad
 * plays best (see lib/recording.ts).
 */
export function VoiceRecorder({ url, mediaMode, onChange, noun = "voice clue", maxSeconds = 60, emphasis = "primary" }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const releaseMic = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  };

  useEffect(() => () => {
    releaseMic();
    player.current?.pause();
  }, []);

  async function start() {
    setError(null);
    setWarning(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't record audio. Try Safari on the iPad.");
      return;
    }
    setState({ kind: "starting" });
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      console.warn("[recorder] microphone permission failed", err);
      setState({ kind: "idle" });
      setError(
        (err as DOMException).name === "NotAllowedError"
          ? "The microphone is blocked. Allow it for this site in your browser settings, then try again."
          : "Couldn't find a microphone.",
      );
      return;
    }

    const mime = pickRecordingMime((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    rec.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data);
    };
    // Release the mic only once the recorder has flushed. WebKit's MP4
    // recorder ignores the timeslice and delivers everything at stop, so
    // assemble the clip a beat later as insurance against a late chunk.
    rec.onstop = () => {
      releaseMic();
      setTimeout(() => void finish(rec.mimeType || mime || "audio/mp4"), FLUSH_GRACE_MS);
    };
    recorder.current = rec;
    rec.start(1000); // 1s slices: audio is collected as it goes, not all at the end

    const startedAt = Date.now();
    setElapsed(0);
    setState({ kind: "recording", startedAt });
    ticker.current = setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= maxSeconds) stop();
    }, 250);
  }

  function stop() {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    else releaseMic();
  }

  async function finish(mime: string) {
    const clip = new Blob(chunks.current, { type: mime });
    if (clip.size === 0) {
      setState({ kind: "idle" });
      // Seen in WebKit when a clip is very short: the encoder hadn't warmed up yet.
      setError("That recording came out empty. Try again, and speak for a few seconds.");
      return;
    }
    setState({ kind: "uploading" });
    try {
      const uploaded = await uploadMedia(clip, `${noun.replace(/\s+/g, "-")}-${Date.now()}.${recordingExtension(mime)}`, mediaMode);
      onChange(uploaded);
      if (mightNotPlayOnIpad(mime)) {
        setWarning("This browser saved the recording as WebM, which some iPads can't play. Record it on the iPad to be safe.");
      }
    } catch (err) {
      console.error("[recorder] upload failed", err);
      setError(err instanceof Error ? err.message : "The recording didn't upload. Try again.");
    } finally {
      setState({ kind: "idle" });
    }
  }

  async function uploadFile(file: File) {
    setError(null);
    setWarning(null);
    const kind = uploadAudioType(file.name);
    if (!kind) {
      setError("That file can't be used. Choose an MP3, M4A, WAV or AAC audio file.");
      return;
    }
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      setError("That file is too big. Audio files can be up to 10 MB.");
      return;
    }
    setState({ kind: "uploading" });
    try {
      // Relabel it by its extension: browsers disagree about audio types, and the server checks.
      const clip = new Blob([file], { type: kind.type });
      onChange(await uploadMedia(clip, `${noun.replace(/\s+/g, "-")}-${Date.now()}.${kind.extension}`, mediaMode));
      if (mightNotPlayOnIpad(kind.type)) setWarning("Some iPads can't play this kind of file. MP3 or M4A is safest.");
    } catch (err) {
      console.error("[recorder] file upload failed", err);
      setError(err instanceof Error ? err.message : "The file didn't upload. Try again.");
    } finally {
      setState({ kind: "idle" });
    }
  }

  const uploadButton = (
    <QuietButton onClick={() => picker.current?.click()} aria-label={url ? `Upload a new ${noun} file` : `Upload a ${noun} file`}>
      <UploadSimple weight="bold" size={18} />
      {url ? "Replace" : "Upload file"}
    </QuietButton>
  );

  function togglePlay() {
    if (!url) return;
    if (playing) {
      player.current?.pause();
      setPlaying(false);
      return;
    }
    const audio = player.current ?? new Audio();
    player.current = audio;
    audio.src = url;
    audio.onended = () => setPlaying(false);
    audio.play().then(
      () => setPlaying(true),
      (err) => {
        console.warn("[recorder] playback failed", err);
        setError("Couldn't play that recording on this device.");
      },
    );
  }

  return (
    <div className="grid gap-2">
      <input
        ref={picker}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.aac"
        className="hidden"
        data-testid={`upload-${noun.replace(/\s+/g, "-")}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // choosing the same file again should still upload
          if (file) void uploadFile(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        {state.kind === "recording" ? (
          <>
            <PlasticButton size="sm" color="tomato" onClick={stop}>
              <Stop weight="fill" size={20} />
              Stop
            </PlasticButton>
            <span className="flex items-center gap-2 text-base font-semibold text-ink" aria-live="polite">
              <span className="size-3 animate-pulse rounded-full bg-tomato motion-reduce:animate-none" aria-hidden />
              Recording {formatDuration(elapsed)}
              <span className="font-normal text-ink/55">of {formatDuration(maxSeconds)}</span>
            </span>
          </>
        ) : state.kind === "uploading" ? (
          <span className="text-base font-semibold text-ink/70" role="status">Saving…</span>
        ) : state.kind === "starting" ? (
          <span className="text-base font-semibold text-ink/70" role="status">Asking for the microphone…</span>
        ) : url ? (
          <>
            <QuietButton onClick={togglePlay}>
              {playing ? <Stop weight="fill" size={18} /> : <Play weight="fill" size={18} />}
              {playing ? "Stop" : `Play ${noun}`}
            </QuietButton>
            <QuietButton onClick={() => void start()}>
              <ArrowCounterClockwise weight="bold" size={18} />
              Re-record
            </QuietButton>
            {uploadButton}
            <QuietButton tone="danger" onClick={() => onChange(undefined)} aria-label={`Delete ${noun}`}>
              <Trash weight="bold" size={18} />
            </QuietButton>
          </>
        ) : emphasis === "quiet" ? (
          <>
            <QuietButton onClick={() => void start()}>
              <Microphone weight="fill" size={18} className="text-tomato" />
              Record {noun} (optional)
            </QuietButton>
            {uploadButton}
          </>
        ) : (
          <>
            <PlasticButton size="sm" color="tomato" onClick={() => void start()}>
              <Microphone weight="fill" size={20} />
              Record {noun}
            </PlasticButton>
            {uploadButton}
          </>
        )}
      </div>
      {warning && <p className="text-sm font-semibold text-[#9A5B00]">{warning}</p>}
      {error && <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p>}
    </div>
  );
}
