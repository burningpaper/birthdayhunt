import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HuntEditor } from "@/components/setup/HuntEditor";
import { mediaMode } from "@/lib/media";
import { emptyProgress } from "@/lib/schema";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Edit hunt · Treasure Hunt Setup" };

export default async function EditHuntPage({ params }: PageProps<"/setup/hunts/[id]">) {
  const { id } = await params;
  const store = getStore();
  const hunt = await store.getHunt(id);
  if (!hunt) notFound();
  const progress = (await store.getProgress(id)) ?? emptyProgress(id);

  return <HuntEditor initialHunt={hunt} initialProgress={progress} mediaMode={mediaMode()} />;
}
