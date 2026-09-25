"use client";

import { Copy, MapTrifold, Trash } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDay } from "@/lib/format";
import { Panel, QuietButton } from "./ui";

export type HuntSummary = {
  id: string;
  title: string;
  status: "draft" | "active";
  createdAt: string;
  found: number;
  total: number;
};

export function HuntList({ hunts }: { hunts: HuntSummary[] }) {
  if (hunts.length === 0) {
    return (
      <Panel className="grid justify-items-center gap-4 py-16 text-center">
        <span className="plastic plastic-tangerine is-round grid size-20 place-items-center">
          <MapTrifold weight="fill" size={44} />
        </span>
        <h2 className="font-display text-3xl text-ink">No hunts yet</h2>
        <p className="max-w-[40ch] text-lg text-ink/70">
          Tap New hunt to start one. It comes with six puzzle stations ready to fill in.
        </p>
      </Panel>
    );
  }

  return (
    <ul className="grid gap-4">
      {hunts.map((hunt, i) => (
        <motion.li
          key={hunt.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 26 }}
        >
          <HuntRow hunt={hunt} />
        </motion.li>
      ))}
    </ul>
  );
}

function HuntRow({ hunt }: { hunt: HuntSummary }) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(path: string, method: "POST" | "DELETE", then: (data: { hunt?: { id: string } }) => void) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, { method });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      then(await res.json());
    } catch (err) {
      console.error(`[setup] ${method} ${path} failed`, err);
      setError("That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="flex flex-wrap items-center justify-between gap-4">
      <Link href={`/setup/hunts/${hunt.id}`} className="grid min-w-0 flex-1 gap-1 rounded-[var(--radius-tile)] focus-visible:outline-3 focus-visible:outline-cobalt">
        <span className="flex flex-wrap items-center gap-3">
          <span className="truncate font-display text-2xl text-ink">{hunt.title}</span>
          <StatusBadge status={hunt.status} />
        </span>
        <span className="text-base text-ink/70">
          {hunt.found} / {hunt.total} found · Created {formatDay(hunt.createdAt)}
        </span>
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        {confirmingDelete ? (
          <>
            <span className="text-base font-semibold text-ink">Delete this hunt and its progress?</span>
            <QuietButton tone="danger" disabled={busy} onClick={() => act(`/api/setup/hunts/${hunt.id}`, "DELETE", () => router.refresh())}>
              Yes, delete
            </QuietButton>
            <QuietButton onClick={() => setConfirmingDelete(false)}>Keep it</QuietButton>
          </>
        ) : (
          <>
            <QuietButton
              disabled={busy}
              onClick={() => act(`/api/setup/hunts/${hunt.id}/duplicate`, "POST", (data) => router.push(`/setup/hunts/${data.hunt?.id}`))}
            >
              <Copy weight="bold" size={18} />
              Duplicate
            </QuietButton>
            <QuietButton tone="danger" onClick={() => setConfirmingDelete(true)} aria-label={`Delete ${hunt.title}`}>
              <Trash weight="bold" size={18} />
            </QuietButton>
          </>
        )}
      </div>
      {error && <p role="alert" className="w-full text-sm font-semibold text-[#B42318]">{error}</p>}
    </Panel>
  );
}

export function StatusBadge({ status }: { status: "draft" | "active" }) {
  return status === "active" ? (
    <span className="rounded-full bg-grass/15 px-3 py-1 text-sm font-bold text-[#146B32]">Live</span>
  ) : (
    <span className="rounded-full bg-ink/8 px-3 py-1 text-sm font-bold text-ink/70">Draft</span>
  );
}
