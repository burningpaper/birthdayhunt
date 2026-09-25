"use client";

import { Plus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlasticButton } from "@/components/plastic/PlasticButton";

export function NewHuntForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/hunts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Birthday Treasure Hunt" }),
      });
      const data = (await res.json()) as { hunt?: { id: string }; error?: string };
      if (!res.ok || !data.hunt) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/setup/hunts/${data.hunt.id}`);
    } catch (err) {
      console.error("[setup] create hunt failed", err);
      setError("Couldn't create the hunt. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="grid justify-items-end gap-2">
      <PlasticButton color="grass" size="sm" onClick={create} disabled={busy}>
        <Plus weight="bold" size={22} />
        {busy ? "Creating…" : "New hunt"}
      </PlasticButton>
      {error && <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p>}
    </div>
  );
}
