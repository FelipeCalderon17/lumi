import type { Dictionary } from "@/i18n";

/**
 * Safety layer 3: a calm, persistent strip at the top of EVERY page with 911 and 988.
 * Static HTML from the reviewed dictionary copy: it works without JavaScript, the AI or the API.
 * "More" opens the full reviewed lines (hospital call button, Spanish option, outside the US).
 *
 * The panel expands IN FLOW (the strip grows and pushes the page down), so it can never paint
 * under or over the header. The summary sits in the first row's corner (absolute), while the
 * `<details>` box itself spans the full row so its panel gets the strip's full width.
 */
export function EmergencyStrip({ t }: { t: Dictionary }) {
  const { strip, actions } = t.safety;
  return (
    <aside
      aria-label={strip.label}
      className="border-b border-line/70 bg-raised/80 text-[0.9rem] has-[details[open]]:bg-raised sm:text-[0.95rem] print:hidden"
    >
      <div className="relative mx-auto max-w-6xl px-5">
        {/* Room for "More": on phones only the first row needs it (the 911 link's margin), so the
            988 line keeps the full width and the strip stays at two rows in Spanish too. */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 sm:pr-24">
          <a
            href="tel:911"
            aria-label={`${strip.emergency}. ${actions.call911}`}
            className="flex min-h-11 items-center gap-2 font-semibold text-text hover:underline max-sm:mr-20"
          >
            <span aria-hidden="true" className="size-2 rounded-pill bg-ember" />
            {strip.emergency}
          </a>
          <a
            href="tel:988"
            aria-label={`${strip.crisis}. ${actions.call988}`}
            className="flex min-h-11 items-center gap-2 text-text hover:underline"
          >
            <span aria-hidden="true" className="size-2 rounded-pill bg-sage" />
            {strip.crisis}
          </a>
        </div>
        <details className="group">
          <summary className="absolute top-0 right-3 flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-pill px-2 text-muted hover:text-text [&::-webkit-details-marker]:hidden">
            {strip.more}
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 transition-transform duration-200 group-open:rotate-180"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </summary>
          <div className="border-t border-line/70 pt-4 pb-5">
            <div className="max-w-3xl space-y-2">
              {[t.emergency.banner, t.emergency.crisisBanner, t.safety.outsideUs].map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="tel:911" className="btn-quiet bg-surface">
                <span aria-hidden="true" className="size-2 rounded-pill bg-ember" />
                {actions.call911}
              </a>
              <a href="tel:988" className="btn-quiet bg-surface">
                <span aria-hidden="true" className="size-2 rounded-pill bg-sage" />
                {actions.call988}
              </a>
              <a href="sms:988" className="btn-quiet bg-surface">
                <span aria-hidden="true" className="size-2 rounded-pill bg-sage" />
                {actions.text988}
              </a>
            </div>
          </div>
        </details>
      </div>
    </aside>
  );
}
