import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/i18n";
import { getKnowledgeBase, KB_TOPICS } from "@/server/knowledge";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/guides">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).guides.title } : {};
}

/** The guide library: the same KB articles Lumi answers from, grouped by category. */
export default async function GuidesPage({ params }: PageProps<"/[locale]/guides">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const kb = await getKnowledgeBase(locale);

  return (
    <section className="mx-auto max-w-6xl px-5 pt-8 sm:pt-12">
      <div className="max-w-3xl">
        <h1 className="text-5xl leading-tight sm:text-6xl">{t.guides.title}</h1>
        <p className="mt-4 text-[1.15rem] text-muted">{t.guides.lede}</p>
      </div>
      <div className="mt-12 grid gap-x-10 gap-y-12 md:grid-cols-2">
        {KB_TOPICS.map((topic) => {
          const articles = kb.articles.filter((article) => article.category === topic);
          if (articles.length === 0) return null;
          return (
            <section key={topic} aria-labelledby={`cat-${topic}`}>
              <h2 id={`cat-${topic}`} className="eyebrow">
                {t.guides.categories[topic]}
              </h2>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {articles.map((article) => (
                  <li key={article.id}>
                    <Link
                      href={`/${locale}/guides/${article.id}`}
                      className="group flex min-h-16 items-center justify-between gap-4 py-3"
                    >
                      <span className="font-display text-[1.35rem] leading-snug transition-colors duration-200 group-hover:text-glow">
                        {article.title}
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
          );
        })}
      </div>
      <p className="mt-14 max-w-2xl border-l-2 border-glow/60 pl-4 text-muted">
        {t.guides.notMedical}
      </p>
    </section>
  );
}
