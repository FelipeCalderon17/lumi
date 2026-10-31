import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n";

type Tone = "ember" | "calm";

/**
 * Fixed, reviewed safety copy (ADR 0003, 0011) as a card. Emergency cards are ember with a
 * dot and a heading (colour never carries the meaning alone) and get call buttons.
 */
export function SafetyCard({
  title,
  body,
  steps,
  tone = "calm",
  actions,
  children,
  headingLevel = 3,
}: {
  title: string;
  body?: string;
  steps?: readonly string[];
  tone?: Tone;
  actions?: ReactNode;
  children?: ReactNode;
  headingLevel?: 2 | 3;
}) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      className={`rounded-soft border p-5 sm:p-6 ${
        tone === "ember" ? "border-ember/60 bg-ember/8" : "border-line bg-surface"
      }`}
    >
      <Heading className="flex items-start gap-3 font-display text-[1.45rem] leading-snug">
        {tone === "ember" && (
          <span
            aria-hidden="true"
            className="mt-[0.55em] size-2.5 shrink-0 rounded-pill bg-ember"
          />
        )}
        {title}
      </Heading>
      {body && <p className="mt-3">{body}</p>}
      {steps && (
        <ol className="mt-3 space-y-2">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-pill border border-line text-sm text-muted"
              >
                {i + 1}
              </span>
              <span className={i === 0 && tone === "ember" ? "font-bold" : undefined}>{step}</span>
            </li>
          ))}
        </ol>
      )}
      {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
      {children}
    </div>
  );
}

/** Call/text buttons for the fixed safety cards. */
export function CallButtons({ t, crisis = false }: { t: Dictionary; crisis?: boolean }) {
  const { actions } = t.safety;
  const primary =
    "inline-flex min-h-12 items-center gap-2 rounded-pill bg-ember px-5 font-bold text-bg transition-transform duration-200 hover:-translate-y-0.5";
  return crisis ? (
    <>
      <a href="tel:988" className={primary}>
        {actions.call988}
      </a>
      <a href="sms:988" className="btn-quiet">
        {actions.text988}
      </a>
      <a href="tel:911" className="btn-quiet">
        {actions.call911}
      </a>
    </>
  ) : (
    <a href="tel:911" className={primary}>
      {actions.call911}
    </a>
  );
}

export function DemoBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-dashed border-glow/70 px-2.5 py-0.5 font-bold text-[0.75rem] text-glow tracking-[0.12em] uppercase">
      <span aria-hidden="true" className="size-1.5 rounded-pill bg-glow" />
      {label}
    </span>
  );
}
