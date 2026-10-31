import type { Dictionary } from "@/i18n";

/**
 * Safety layer 3: a calm, persistent strip at the top of EVERY page with 911 and 988.
 * Static HTML from the reviewed dictionary copy: it works without JavaScript, the AI or the API.
 * "More" opens the full reviewed lines (hospital call button, Spanish option, outside the US).
 */
export function EmergencyStrip({ t }: { t: Dictionary }) {
  const { strip, actions } = t.safety;
  return (
    <aside
      aria-label={strip.label}
      className="relative border-b border-line/70 bg-raised/80 text-[0.95rem] print:hidden"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-0 px-5">
        <a
          href="tel:911"
          aria-label={`${strip.emergency}. ${actions.call911}`}
          className="flex min-h-11 items-center gap-2 font-semibold text-text hover:underline"
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
        <details className="group ml-auto">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-muted hover:text-text [&::-webkit-details-marker]:hidden">
            {strip.more}
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-200 group-open:rotate-180"
            >
              ⌄
            </span>
          </summary>
          <div className="absolute inset-x-0 top-full z-30 border-b border-line bg-raised shadow-[0_18px_40px_-20px_rgb(0_0_0/0.5)]">
            <div className="mx-auto max-w-6xl space-y-2 px-5 py-4">
              {[t.emergency.banner, t.emergency.crisisBanner, t.safety.outsideUs].map((line) => (
                <p key={line} className="max-w-3xl">
                  {line}
                </p>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <a href="tel:911" className="btn-quiet">
                  {actions.call911}
                </a>
                <a href="tel:988" className="btn-quiet">
                  {actions.call988}
                </a>
                <a href="sms:988" className="btn-quiet">
                  {actions.text988}
                </a>
              </div>
            </div>
          </div>
        </details>
      </div>
    </aside>
  );
}
