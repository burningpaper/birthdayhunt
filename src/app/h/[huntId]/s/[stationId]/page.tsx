import type { Metadata } from "next";
import { PlayShell } from "@/components/play/PlayShell";
import { StationPlayer } from "@/components/play/StationPlayer";
import { loadScan } from "@/lib/play";
import { toPlayResponse } from "@/lib/playState";

export const metadata: Metadata = { title: "Treasure Hunt" };

/**
 * The page a QR code opens. Order enforcement happens here on the server, so
 * the first paint already shows the right screen and the HTML contains only
 * what toPlayResponse allows.
 */
export default async function StationPage({ params, searchParams }: PageProps<"/h/[huntId]/s/[stationId]">) {
  const { huntId, stationId } = await params;
  const query = await searchParams;
  const search = new URLSearchParams();
  for (const name of ["k", "preview"] as const) {
    const value = query[name];
    if (typeof value === "string") search.set(name, value);
  }

  const { hunt, decision, preview } = await loadScan(huntId, stationId, search);
  const initial = toPlayResponse(hunt, decision);

  return (
    <PlayShell>
      <StationPlayer initial={initial} huntId={huntId} stationKey={search.get("k") ?? ""} preview={preview} />
    </PlayShell>
  );
}
