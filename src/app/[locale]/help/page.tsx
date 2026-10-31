import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AskLumi } from "@/components/ask/ask-lumi";
import { getDictionary, isLocale } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/help">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).help.title } : {};
}

/** Ask Lumi: the deep slice. The 911/988 strip above is static and works without the API. */
export default async function HelpPage({ params }: PageProps<"/[locale]/help">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <section className="mx-auto max-w-6xl px-5 pt-8 sm:pt-12">
      <div className="max-w-3xl">
        <h1 className="text-5xl leading-tight sm:text-6xl">{t.help.title}</h1>
        <p className="mt-4 text-[1.15rem] text-muted">{t.help.lede}</p>
      </div>
      {/* The chat card, the boundaries note and the quick-start chips (side column on large screens). */}
      <AskLumi locale={locale} t={t} />
    </section>
  );
}
