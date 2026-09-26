import { Camera, QrCode } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { connection } from "next/server";
import { StartScreen } from "@/components/play/StartScreen";
import { ScanButton } from "@/components/scan/ScanButton";
import { currentLiveHunt } from "@/lib/liveHunt";
import type { Hunt } from "@/lib/schema";
import { getStore } from "@/lib/store";

/**
 * The front door. While a hunt is live it's the start screen: one big red
 * button that plays the parent's welcome and opens the scanner. Otherwise
 * it's a plain "scan a code" page. Only the welcome recording's address
 * reaches the browser, never anything else about the hunt.
 */
export default async function Home() {
  await connection(); // which hunt is live changes; never serve a copy from build time
  const live = await liveHunt();
  if (live) return <StartScreen welcomeUrl={live.voiceLines?.["start.welcome"] || undefined} />;
  return <ScanHome />;
}

async function liveHunt(): Promise<Hunt | null> {
  try {
    return currentLiveHunt(await getStore().listHunts());
  } catch (error) {
    // The plain front page still works (it scans codes), so fall back to it rather than fail.
    console.error("[home] couldn't load hunts for the start screen", error);
    return null;
  }
}

/** No hunt live: a big button that opens the in-page scanner. The iPad's Camera app works too, because printed codes are ordinary links. */
function ScanHome() {
  return (
    <main className="toybox grid min-h-dvh place-items-center px-4 py-10 text-center">
      <div className="grid justify-items-center gap-8">
        <div className="plastic plastic-sunflower is-panel grid size-40 place-items-center">
          <QrCode weight="fill" size={96} />
        </div>
        <h1 className="max-w-[16ch] font-display text-6xl text-balance">Find a treasure code and scan it!</h1>
        <ScanButton size="xl" color="sunflower" />
        <p className="flex max-w-[40ch] items-center gap-3 text-left text-xl font-semibold text-balance text-cream/70">
          <Camera weight="fill" size={32} className="shrink-0 text-cream/60" aria-hidden />
          Or open the iPad&apos;s Camera app, point it at the code, and tap the link that pops up.
        </p>
        <Link href="/setup" className="rounded-[var(--radius-tile)] px-3 py-2 text-lg font-semibold text-cream/70 underline-offset-4 hover:text-cream hover:underline focus-visible:outline-3 focus-visible:outline-sunflower">
          Grown-ups: set up a hunt
        </Link>
      </div>
    </main>
  );
}
