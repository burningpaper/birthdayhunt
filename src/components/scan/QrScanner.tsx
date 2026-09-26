"use client";

import { CameraSlash, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PlasticButton } from "@/components/plastic/PlasticButton";
import { snap } from "@/lib/audio/sfx";
import { decodeFrame, treasurePathFrom } from "@/lib/scan";

const SCAN_EVERY_MS = 120;
const MAX_FRAME_EDGE = 720; // decoding a smaller frame is quicker and just as reliable
const NOT_OURS_MS = 2200;

type State =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "found" }
  | { kind: "blocked"; reason: "denied" | "no-camera" | "unsupported" };

/**
 * A full-screen QR scanner that reads treasure codes without leaving the
 * page. It only ever opens station links on this site (lib/scan.ts).
 */
export function QrScanner({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>({ kind: "starting" });
  const [notOurs, setNotOurs] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let notOursTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const stop = () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (notOursTimer) clearTimeout(notOursTimer);
      stream?.getTracks().forEach((track) => track.stop());
    };

    const scanOnce = () => {
      const v = video.current;
      if (!v || !context || v.readyState < v.HAVE_CURRENT_DATA || !v.videoWidth) return;
      const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(v.videoWidth, v.videoHeight));
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      context.drawImage(v, 0, 0, canvas.width, canvas.height);
      const text = decodeFrame(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      if (!text) return;

      const path = treasurePathFrom(text);
      if (path) {
        stop();
        snap();
        setState({ kind: "found" });
        // A full page load: each station starts fresh, with its own "Tap to start!".
        window.location.assign(path);
        return;
      }
      setNotOurs(true);
      if (notOursTimer) clearTimeout(notOursTimer);
      notOursTimer = setTimeout(() => setNotOurs(false), NOT_OURS_MS);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState({ kind: "blocked", reason: "unsupported" });
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (error) {
        console.warn("[scan] camera unavailable", error);
        const name = (error as DOMException).name;
        setState({ kind: "blocked", reason: name === "NotAllowedError" || name === "SecurityError" ? "denied" : "no-camera" });
        return;
      }
      if (stopped || !video.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.current.srcObject = stream;
      await video.current.play().catch((error) => console.warn("[scan] video play failed", error));
      setState({ kind: "scanning" });
      timer = setInterval(scanOnce, SCAN_EVERY_MS);
    };

    void start();
    return stop;
  }, []);

  return (
    <motion.div
      className="toybox play-surface fixed inset-0 z-50 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Scan a treasure code"
    >
      <video ref={video} className="absolute inset-0 size-full object-cover" playsInline muted autoPlay aria-hidden />

      {state.kind !== "blocked" && (
        <div className="absolute inset-0 grid place-items-center">
          {/* The viewfinder: everything outside it is dimmed. */}
          <div
            className={`scan-frame relative aspect-square w-[min(58vh,60vw)] rounded-[var(--radius-panel)] ${state.kind === "found" ? "is-found" : ""}`}
            data-state={state.kind}
          >
            <span className="scan-corner top-0 left-0 border-t-8 border-l-8" />
            <span className="scan-corner top-0 right-0 border-t-8 border-r-8" />
            <span className="scan-corner bottom-0 left-0 border-b-8 border-l-8" />
            <span className="scan-corner right-0 bottom-0 border-r-8 border-b-8" />
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-6">
        <p className="rounded-[var(--radius-button)] bg-toybox/80 px-5 py-3 text-2xl font-bold text-balance">
          {state.kind === "found" ? "Got it!" : state.kind === "starting" ? "Opening the camera…" : "Point the camera at a treasure code"}
        </p>
        <PlasticButton round size="md" color="cream" aria-label="Close the scanner" onClick={onClose}>
          <X weight="bold" size={30} />
        </PlasticButton>
      </div>

      <AnimatePresence>
        {notOurs && (
          <motion.p
            className="absolute inset-x-0 bottom-10 mx-auto w-fit rounded-[var(--radius-button)] bg-cream px-6 py-3 text-2xl font-bold text-ink shadow-[0_6px_0_rgb(8_14_36_/_0.35)]"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            role="status"
          >
            Hmm, that&apos;s not a treasure code!
          </motion.p>
        )}
      </AnimatePresence>

      {state.kind === "blocked" && <Blocked reason={state.reason} onClose={onClose} />}
    </motion.div>
  );
}

function Blocked({ reason, onClose }: { reason: "denied" | "no-camera" | "unsupported"; onClose: () => void }) {
  const detail =
    reason === "denied"
      ? "Ask a grown-up to allow the camera: tap “aA” in the address bar, then Website Settings, then Camera: Allow."
      : reason === "no-camera"
        ? "This device's camera isn't available right now."
        : "This browser can't use the camera here.";
  return (
    <div className="absolute inset-0 grid place-items-center p-8 text-center">
      <div className="grid max-w-[40ch] justify-items-center gap-6">
        <div className="plastic plastic-tangerine is-round grid size-28 place-items-center">
          <CameraSlash weight="fill" size={60} />
        </div>
        <h2 className="font-display text-5xl">The camera is shy!</h2>
        <p className="text-2xl font-semibold text-balance text-cream/85">{detail}</p>
        <p className="text-xl text-balance text-cream/70">You can also scan codes with the iPad&apos;s Camera app.</p>
        <PlasticButton size="md" color="sunflower" onClick={onClose}>
          OK
        </PlasticButton>
      </div>
    </div>
  );
}
