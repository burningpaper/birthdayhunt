"use client";

import { LockKey } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlasticButton } from "@/components/plastic/PlasticButton";

/** The parent PIN. Checked on the server; the browser only keeps a signed cookie. */
export function LoginForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        router.replace("/setup");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Something went wrong. Try again.");
      setShake((n) => n + 1);
      setPin("");
    } catch (err) {
      console.error("[login] request failed", err);
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid w-full max-w-sm justify-items-center gap-6 text-center">
      <div className="plastic plastic-bubblegum is-round grid size-24 place-items-center">
        <LockKey weight="fill" size={52} />
      </div>
      <h1 className="font-display text-5xl text-cream">Grown-ups only</h1>
      <label className="grid w-full gap-2 text-left">
        <span className="text-sm font-bold text-cream/80">Parent PIN</span>
        <input
          key={shake}
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          required
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className={`w-full rounded-[var(--radius-tile)] border-2 border-cream/25 bg-cream/10 px-5 py-4 text-center text-3xl tracking-[0.4em] text-cream placeholder:text-cream/40 focus:border-sunflower focus:outline-none ${shake ? "rattle" : ""}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "pin-error" : undefined}
        />
      </label>
      {error && (
        <p id="pin-error" role="alert" className="text-lg font-semibold text-sunflower">
          {error}
        </p>
      )}
      <PlasticButton type="submit" size="md" color="sunflower" disabled={busy || !pin} className="w-full">
        {busy ? "Checking…" : "Unlock"}
      </PlasticButton>
    </form>
  );
}
