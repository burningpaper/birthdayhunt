import { QrCode } from "@phosphor-icons/react/ssr";
import Link from "next/link";

/** Nobody is meant to land here; QR codes open station pages directly. */
export default function Home() {
  return (
    <main className="toybox grid min-h-dvh place-items-center px-4 py-10 text-center">
      <div className="grid justify-items-center gap-8">
        <div className="plastic plastic-sunflower is-panel grid size-40 place-items-center">
          <QrCode weight="fill" size={96} />
        </div>
        <h1 className="max-w-[16ch] font-display text-6xl text-balance">Find a treasure code and scan it!</h1>
        <Link href="/setup" className="rounded-[var(--radius-tile)] px-3 py-2 text-lg font-semibold text-cream/70 underline-offset-4 hover:text-cream hover:underline focus-visible:outline-3 focus-visible:outline-sunflower">
          Grown-ups: set up a hunt
        </Link>
      </div>
    </main>
  );
}
