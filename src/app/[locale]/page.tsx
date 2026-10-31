import Link from "next/link";
import { notFound } from "next/navigation";
import { NightWindow } from "@/components/night-window";
import { getDictionary, isLocale } from "@/i18n";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const h = t.home;
  const goals = [
    { key: "support", ...h.goals.support, href: `/${locale}/help`, mark: "I" },
    { key: "funds", ...h.goals.funds, href: `/${locale}/donate`, mark: "II" },
    { key: "volunteers", ...h.goals.volunteers, href: `/${locale}/volunteer`, mark: "III" },
  ];

  return (
    <>
      {/* Hero: the lantern on the night table. */}
      <section className="mx-auto grid max-w-6xl items-center gap-6 px-5 pt-6 pb-16 sm:pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:pb-24">
        <div className="order-2 lg:order-1">
          <p className="eyebrow">{h.eyebrow}</p>
          <h1 className="mt-5 text-[2.9rem] leading-[1.02] sm:text-7xl lg:text-[5.2rem]">
            {h.titleStart} <em className="text-glow italic">{h.titleEmphasis}</em>
          </h1>
          <p className="mt-7 max-w-xl text-[1.2rem] text-muted">{h.lede}</p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link href={`/${locale}/help`} className="btn-lantern text-[1.08rem]">
              {h.cta}
              <span aria-hidden="true">→</span>
            </Link>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href={`/${locale}/notebook`} className="link inline-flex min-h-11 items-center">
                {h.ctaNotebook}
              </Link>
              <Link
                href={`/${locale}/community`}
                className="link inline-flex min-h-11 items-center"
              >
                {h.ctaCircles}
              </Link>
            </div>
          </div>
        </div>
        <div className="order-1 mx-auto w-56 sm:w-72 lg:order-2 lg:w-full lg:max-w-md">
          <NightWindow className="h-auto w-full" />
        </div>
      </section>

      {/* The three goals. */}
      <section className="border-y border-line/60 bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <p className="eyebrow">{h.goalsEyebrow}</p>
          <h2 className="mt-3 max-w-2xl text-4xl leading-tight sm:text-5xl">{h.goalsTitle}</h2>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-soft border border-line bg-line sm:grid-cols-3">
            {goals.map((goal) => (
              <li key={goal.key} className="flex flex-col bg-bg p-7">
                <span aria-hidden="true" className="font-display text-glow text-xl italic">
                  {goal.mark}
                </span>
                <h3 className="mt-4 text-2xl">{goal.title}</h3>
                <p className="mt-3 flex-1 text-muted">{goal.body}</p>
                <Link
                  href={goal.href}
                  className="link mt-6 inline-flex min-h-11 items-center gap-2 font-semibold"
                >
                  {goal.cta}
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Ask Lumi: what it is, and what it promises. */}
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="eyebrow">{h.askEyebrow}</p>
          <h2 className="mt-3 text-4xl leading-tight sm:text-5xl">{h.askTitle}</h2>
          <p className="mt-5 max-w-lg text-muted">{h.askBody}</p>
          <Link href={`/${locale}/help`} className="btn-quiet mt-8">
            {t.nav.help}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ul className="space-y-4 self-center">
          {h.askPromises.map((promise) => (
            <li
              key={promise}
              className="flex gap-4 rounded-soft border border-line bg-surface p-5 text-[1.08rem]"
            >
              <span
                aria-hidden="true"
                className="mt-2 size-2.5 shrink-0 rounded-pill bg-lantern shadow-[0_0_12px_2px_rgb(246_190_79/0.55)]"
              />
              {promise}
            </li>
          ))}
        </ul>
      </section>

      {/* Notebook and circles side by side. */}
      <section className="mx-auto grid max-w-6xl gap-5 px-5 md:grid-cols-2">
        <Link
          href={`/${locale}/notebook`}
          className="group relative overflow-hidden rounded-soft border border-line bg-surface p-8 transition-colors duration-300 hover:border-glow/70"
        >
          <NotebookDoodle />
          <p className="eyebrow">{h.notebookEyebrow}</p>
          <h2 className="mt-3 max-w-sm text-3xl leading-tight">{h.notebookTitle}</h2>
          <p className="mt-4 max-w-md text-muted">{h.notebookBody}</p>
          <span className="mt-6 inline-flex items-center gap-2 font-semibold text-glow">
            {h.ctaNotebook}
            <span
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </span>
        </Link>
        <Link
          href={`/${locale}/community`}
          className="group relative overflow-hidden rounded-soft border border-line bg-surface p-8 transition-colors duration-300 hover:border-glow/70"
        >
          <CircleDoodle />
          <p className="eyebrow">{h.circlesEyebrow}</p>
          <h2 className="mt-3 max-w-sm text-3xl leading-tight">{h.circlesTitle}</h2>
          <p className="mt-4 max-w-md text-muted">{h.circlesBody}</p>
          <span className="mt-6 inline-flex items-center gap-2 font-semibold text-glow">
            {h.ctaCircles}
            <span
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </span>
        </Link>
      </section>

      {/* Closing: give or volunteer. */}
      <section className="mx-auto max-w-6xl px-5 pt-20">
        <div className="relative overflow-hidden rounded-soft border border-line bg-raised/60 px-7 py-12 sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-pill bg-lantern/20 blur-3xl"
          />
          <h2 className="max-w-xl text-4xl leading-tight">{h.closingTitle}</h2>
          <p className="mt-3 max-w-xl text-muted">{h.closingBody}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/${locale}/donate`} className="btn-quiet border-glow/60">
              {t.nav.donate}
            </Link>
            <Link href={`/${locale}/volunteer`} className="btn-quiet">
              {t.nav.volunteer}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function NotebookDoodle() {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      className="pointer-events-none absolute -right-4 -bottom-4 size-36 text-line opacity-80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <rect x="22" y="14" width="70" height="92" rx="8" />
      <path d="M36 40h40M36 54h40M36 68h26" />
      <path d="M22 30h-8M22 50h-8M22 70h-8M22 90h-8" />
      <circle cx="94" cy="96" r="5" fill="#f6be4f" stroke="none" />
    </svg>
  );
}

function CircleDoodle() {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      className="pointer-events-none absolute -right-4 -bottom-4 size-36 text-line opacity-80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <circle cx="60" cy="60" r="34" strokeDasharray="4 8" strokeLinecap="round" />
      {[0, 72, 144, 216, 288].map((deg) => {
        const r = (deg * Math.PI) / 180;
        return <circle key={deg} cx={60 + 34 * Math.cos(r)} cy={60 + 34 * Math.sin(r)} r="7" />;
      })}
      <circle cx="60" cy="60" r="6" fill="#f6be4f" stroke="none" />
    </svg>
  );
}
