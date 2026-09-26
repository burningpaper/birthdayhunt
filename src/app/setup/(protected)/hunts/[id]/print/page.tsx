import { Camera } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/setup/PrintButton";
import { PUZZLE_META } from "@/lib/puzzleMeta";
import { qrSvg, siteOrigin, stationUrl } from "@/lib/qr";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Print QR codes · Treasure Hunt Setup" };

/** A4 sheet of station codes (spec §7.4): two per page, or four with ?size=quarter. */
export default async function PrintPage({ params, searchParams }: PageProps<"/setup/hunts/[id]/print">) {
  const { id } = await params;
  const quarter = (await searchParams).size === "quarter";
  const hunt = await getStore().getHunt(id);
  if (!hunt) notFound();

  const origin = await siteOrigin();
  const cards = await Promise.all(
    hunt.stations.map(async (station) => ({ station, svg: await qrSvg(stationUrl(origin, hunt, station)) })),
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="grid gap-1">
          <h1 className="font-display text-4xl text-ink">QR codes for {hunt.title}</h1>
          <p className="text-base text-ink/70">
            Codes point to <strong>{origin}</strong>. Cut them out along the dashed lines, and fold the hiding note under. To play, scan a code with the iPad&apos;s Camera app and tap the link that pops up. To test without printing, scan one straight off this screen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={quarter ? "?" : "?size=quarter"} className="text-base font-semibold text-cobalt underline-offset-4 hover:underline">
            {quarter ? "Bigger codes (2 per page)" : "Smaller codes (4 per page)"}
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className={`print-sheet grid gap-4 print:gap-0 ${quarter ? "sm:grid-cols-2 print:grid-cols-2" : ""}`} data-size={quarter ? "quarter" : "half"}>
        {cards.map(({ station, svg }) => {
          const meta = PUZZLE_META[station.puzzle.type];
          return (
            <article key={station.id} className="qr-card relative grid place-items-center gap-4 rounded-[var(--radius-panel)] border-2 border-dashed border-ink/25 bg-white p-8 text-center print:rounded-none">
              <div className="flex items-center gap-5">
                <span className={`plastic plastic-${meta.color} is-round grid size-20 place-items-center font-display text-5xl`}>{station.order}</span>
                <span className="flex items-center gap-3 font-display text-5xl text-ink">
                  Scan me!
                  <Camera weight="fill" size={48} className="text-ink" />
                </span>
              </div>
              <div className="qr-code w-full max-w-[9cm] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
              <p className="absolute inset-x-0 bottom-2 text-[9px] text-ink/45">
                Station {station.order}: {station.hidingNote || "no hiding note"}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
