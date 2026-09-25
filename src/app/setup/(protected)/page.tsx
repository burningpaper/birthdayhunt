import type { Metadata } from "next";
import { HuntList } from "@/components/setup/HuntList";
import { NewHuntForm } from "@/components/setup/NewHuntForm";
import { emptyProgress } from "@/lib/schema";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Hunts · Treasure Hunt Setup" };

export default async function HuntsPage() {
  const store = getStore();
  const hunts = (await store.listHunts()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const summaries = await Promise.all(
    hunts.map(async (hunt) => {
      const progress = (await store.getProgress(hunt.id)) ?? emptyProgress(hunt.id);
      return {
        id: hunt.id,
        title: hunt.title,
        status: hunt.status,
        createdAt: hunt.createdAt,
        found: progress.completedStationIds.length,
        total: hunt.stations.length,
      };
    }),
  );

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl text-ink">Your hunts</h1>
        <NewHuntForm />
      </div>
      <HuntList hunts={summaries} />
    </div>
  );
}
