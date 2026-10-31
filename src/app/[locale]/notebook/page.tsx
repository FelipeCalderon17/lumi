import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Notebook } from "@/components/notebook/notebook";
import { getDictionary, isLocale } from "@/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/notebook">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).notebook.title } : {};
}

export default async function NotebookPage({ params }: PageProps<"/[locale]/notebook">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const n = t.notebook;

  return (
    <section className="mx-auto max-w-6xl px-5 pt-8 sm:pt-12">
      <div className="max-w-3xl print:hidden">
        <h1 className="text-5xl leading-tight sm:text-6xl">{n.title}</h1>
        <p className="mt-4 text-[1.15rem] text-muted">{n.lede}</p>
        <p className="mt-4 flex gap-3 text-[0.98rem]">
          <span aria-hidden="true" className="mt-[0.6em] size-2 shrink-0 rounded-pill bg-sage" />
          <span>{n.privacy}</span>
        </p>
      </div>
      <Notebook locale={locale} t={t} />
    </section>
  );
}
