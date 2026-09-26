import { Camera, QrCode } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { ScanButton } from "@/components/scan/ScanButton";

/**
 * The front door: a big button that opens the in-page scanner. The iPad's
 * Camera app works too, because printed codes are ordinary links.
 */
export default function Home() {
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
