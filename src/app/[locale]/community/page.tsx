import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JoinButton } from "@/components/demo/join-button";
import { DemoBadge } from "@/components/safety-card";
import { getDictionary, isLocale } from "@/i18n";
import { getKnowledgeBase } from "@/server/knowledge";

/** Guides for the harder days, linked from "Comfort reading". */
const COMFORT_GUIDES = [
  "taking-care-of-yourself",
  "talking-with-siblings",
  "talking-with-your-child",
  "how-lumi-can-help",
] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/community">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).community.title } : {};
}

/** Parent Circles: a MOCK, clearly labelled demo. Grouped by situation, not diagnosis. */
export default async function CommunityPage({ params }: PageProps<"/[locale]/community">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const c = t.community;
  const kb = await getKnowledgeBase(locale);
  const comfort = COMFORT_GUIDES.flatMap((id) => kb.byId.get(id) ?? []);

  return (
    <section className="mx-auto max-w-6xl px-5 pt-8 sm:pt-12">
      <div className="max-w-3xl">
        <DemoBadge label={t.common.demo} />
        <h1 className="mt-4 text-5xl leading-tight sm:text-6xl">{c.title}</h1>
        <p className="mt-4 text-[1.15rem] text-muted">{c.lede}</p>
        <p className="mt-4 text-[0.98rem] text-muted">{c.demoNote}</p>
      </div>

      <ul className="mt-12 grid gap-5 md:grid-cols-2">
        {c.circles.map((circle, i) => (
          <li
            key={circle.id}
            className={`flex flex-col rounded-soft border border-dashed border-line bg-surface/60 p-6 sm:p-7 ${
              i === 1 ? "md:row-span-1 md:bg-raised/60" : ""
            }`}
          >
            <h2 className="text-[1.7rem] leading-tight">{circle.title}</h2>
            <p className="mt-3 flex-1 text-muted">{circle.body}</p>
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.98rem]">
              <dt className="text-muted">{c.whenLabel}</dt>
              <dd>{circle.when}</dd>
              <dt className="text-muted">{c.formatLabel}</dt>
              <dd>{circle.format}</dd>
              <dt className="text-muted">{c.languageLabel}</dt>
              <dd>{circle.language}</dd>
            </dl>
            <div className="mt-6">
              <JoinButton join={c.join} joined={c.joined} />
            </div>
          </li>
        ))}
      </ul>

      <section aria-labelledby="comfort" className="mt-20">
        <h2 id="comfort" className="text-4xl">
          {c.comfortTitle}
        </h2>
        <p className="mt-2 text-muted">{c.comfortLede}</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {comfort.map((article) => (
            <li key={article.id}>
              <Link
                href={`/${locale}/guides/${article.id}`}
                className="group flex min-h-16 items-center justify-between gap-4 rounded-soft border border-line bg-surface px-5 py-4 transition-colors duration-200 hover:border-glow/70"
              >
                <span className="font-display text-xl leading-snug">{article.title}</span>
                <span
                  aria-hidden="true"
                  className="text-glow transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
