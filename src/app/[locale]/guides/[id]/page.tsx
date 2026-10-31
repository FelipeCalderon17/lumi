import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { getDictionary, isLocale, locales } from "@/i18n";
import { fill } from "@/i18n/format";
import { formatDay } from "@/lib/dates";
import { getKnowledgeBase } from "@/server/knowledge";

export async function generateStaticParams() {
  const params = await Promise.all(
    locales.map(async (locale) =>
      (await getKnowledgeBase(locale)).articles.map((article) => ({ locale, id: article.id })),
    ),
  );
  return params.flat();
}

async function findArticle(locale: string, id: string) {
  if (!isLocale(locale)) return null;
  return (await getKnowledgeBase(locale)).byId.get(id) ?? null;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/guides/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const article = await findArticle(locale, id);
  return article ? { title: article.title } : {};
}

/**
 * One guide. Citations in Lumi's answers link here. Same outer width as every page; the body
 * keeps a reading measure, and large screens get a side column (Ask Lumi, more on this topic).
 */
export default async function GuidePage({ params }: PageProps<"/[locale]/guides/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const kb = await getKnowledgeBase(locale);
  const article = kb.byId.get(id);
  if (!article) notFound();
  const t = getDictionary(locale);
  const reviewed = formatDay(new Date(`${article.reviewedAt}T12:00:00Z`), locale);
  const related = kb.articles.filter((a) => a.category === article.category && a.id !== article.id);

  return (
    <div className="mx-auto max-w-6xl px-5 pt-8 sm:pt-12">
      <Link
        href={`/${locale}/guides`}
        className="link inline-flex min-h-11 items-center gap-2 text-[0.98rem]"
      >
        <span aria-hidden="true">←</span> {t.guides.allGuides}
      </Link>
      <div className="mt-6 grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-16">
        <article className="min-w-0 max-w-[68ch]">
          <p className="eyebrow">{t.guides.categories[article.category]}</p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">{article.title}</h1>
          <p className="mt-3 text-[0.95rem] text-muted">
            {fill(t.guides.reviewed, { date: reviewed })}
          </p>
          <Markdown source={article.body} className="mt-10 text-[1.12rem]" />
        </article>
        <aside className="space-y-10 lg:sticky lg:top-6 lg:self-start lg:pt-2">
          <div className="rounded-soft border border-line bg-surface p-6">
            <p className="text-muted">{t.guides.notMedical}</p>
            <Link href={`/${locale}/help`} className="btn-quiet mt-4">
              {t.guides.askAbout}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          {related.length > 0 && (
            <section aria-labelledby="related-guides">
              <h2 id="related-guides" className="eyebrow">
                {t.guides.relatedTitle}
              </h2>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {related.map((other) => (
                  <li key={other.id}>
                    <Link
                      href={`/${locale}/guides/${other.id}`}
                      className="group flex min-h-14 items-center justify-between gap-4 py-3"
                    >
                      <span className="font-display text-[1.15rem] leading-snug transition-colors duration-200 group-hover:text-glow">
                        {other.title}
                      </span>
                      <span
                        aria-hidden="true"
                        className="text-muted transition-transform duration-300 group-hover:translate-x-1 group-hover:text-glow"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
