import { TreasureChest } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/setup/SignOutButton";
import { isSetupAuthed } from "@/lib/auth";

/** Every page under here needs the parent session. The real check, not a proxy hint. */
export default async function ProtectedSetupLayout({ children }: LayoutProps<"/setup">) {
  if (!(await isSetupAuthed())) redirect("/setup/login");

  return (
    <div className="min-h-dvh bg-paper print:min-h-0 print:bg-white">
      <header className="border-b border-ink/10 bg-white/80 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/setup" className="flex items-center gap-3 rounded-[var(--radius-tile)] font-display text-2xl text-ink focus-visible:outline-3 focus-visible:outline-cobalt">
            <span className="plastic plastic-sunflower is-tile grid size-10 place-items-center">
              <TreasureChest weight="fill" size={24} />
            </span>
            Treasure Hunt Setup
          </Link>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8 print:max-w-none print:p-0">{children}</div>
    </div>
  );
}
