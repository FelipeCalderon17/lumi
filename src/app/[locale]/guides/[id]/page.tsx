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

/** One guide. Citations in Lumi's answers link here. */
export default async function GuidePage({ params }: PageProps<"/[locale]/guides/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const article = await findArticle(locale, id);
  if (!article) notFound();
  const t = getDictionary(locale);
  const reviewed = formatDay(new Date(`${article.reviewedAt}T12:00:00Z`), locale);

  return (
    <article className="mx-auto max-w-2xl px-5 pt-8 sm:pt-12">
      <Link
        href={`/${locale}/guides`}
        className="link inline-flex min-h-11 items-center gap-2 text-[0.98rem]"
      >
        <span aria-hidden="true">←</span> {t.guides.allGuides}
      </Link>
      <p className="eyebrow mt-6">{t.guides.categories[article.category]}</p>
      <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">{article.title}</h1>
      <p className="mt-3 text-[0.95rem] text-muted">
        {fill(t.guides.reviewed, { date: reviewed })}
      </p>
      <Markdown source={article.body} className="mt-10 text-[1.12rem]" />
      <div className="mt-14 rounded-soft border border-line bg-surface p-6">
        <p className="text-muted">{t.guides.notMedical}</p>
        <Link href={`/${locale}/help`} className="btn-quiet mt-4">
          {t.guides.askAbout}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
