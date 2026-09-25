import { CaretDown } from "@phosphor-icons/react/ssr";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * The parent side's quiet building blocks. Same fonts, radii and colours as
 * the play side, but no plastic: that is saved for primary actions.
 */

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius-panel)] bg-white p-6 shadow-[0_1px_0_rgb(20_33_63_/_0.06),0_12px_32px_-16px_rgb(20_33_63_/_0.25)] ${className}`}>
      {children}
    </section>
  );
}

type QuietButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "danger" };

export function QuietButton({ tone = "default", className = "", type = "button", ...rest }: QuietButtonProps) {
  const toneClass =
    tone === "danger"
      ? "text-[#B42318] border-[#F3C3BE] hover:bg-[#FEF1F0]"
      : "text-ink border-ink/15 hover:bg-ink/5";
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-button)] border-2 bg-white px-4 text-base font-semibold whitespace-nowrap transition-[transform,background-color] duration-150 active:scale-[0.97] disabled:opacity-40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt ${toneClass} ${className}`}
      {...rest}
    />
  );
}

const fieldClass =
  "w-full rounded-[var(--radius-tile)] border-2 border-ink/15 bg-white px-4 py-3 text-lg text-ink placeholder:text-ink/45 transition-colors focus:border-cobalt focus:outline-none";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid content-start gap-2">
      <span className="text-sm font-bold text-ink">{label}</span>
      {children}
      {hint && <span className="text-sm text-ink/65">{hint}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" className={fieldClass} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} className={`${fieldClass} resize-y`} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select className={`${fieldClass} appearance-none pr-12`} {...props} />
      <CaretDown weight="bold" size={20} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink/60" aria-hidden />
    </span>
  );
}

/** A pill-shaped choice group (difficulty, piece counts, and so on). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-[var(--radius-button)] bg-ink/6 p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-10 rounded-[16px] px-4 text-base font-semibold transition-all duration-150 focus-visible:outline-3 focus-visible:outline-cobalt ${
              selected ? "bg-white text-ink shadow-[0_2px_6px_rgb(20_33_63_/_0.15)]" : "text-ink/65 hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 select-none">
      <span className="relative inline-flex">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-8 w-14 rounded-full bg-ink/20 transition-colors peer-checked:bg-grass peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cobalt" />
        <span className="absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-6" />
      </span>
      <span className="text-base font-semibold text-ink">{label}</span>
    </label>
  );
}
