import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/i18n";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const { sections } = t.home;

  return (
    <>
      <section className="max-w-3xl py-16 sm:py-24">
        <p className="text-sm tracking-wide text-glow uppercase">{t.home.eyebrow}</p>
        <h1 className="mt-4 font-display text-5xl leading-[1.05] tracking-tight text-balance sm:text-7xl">
          {t.home.title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted text-pretty">{t.home.lede}</p>
        <Link
          href={`/${locale}/help`}
          className="mt-10 inline-flex items-center gap-3 rounded-pill bg-lantern px-6 py-3 font-medium text-on-lantern shadow-[0_0_40px_-8px_#f6be4f] transition-transform duration-300 ease-lumi hover:-translate-y-0.5"
        >
          {t.home.cta}
          <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="grid gap-4 pb-16 sm:grid-cols-3">
        <article className="rounded-soft border border-line bg-surface p-6 sm:col-span-2">
          <h2 className="font-display text-2xl">{sections.help.title}</h2>
          <p className="mt-2 text-muted">{sections.help.body}</p>
        </article>
        <div className="grid gap-4">
          <article id="donate" className="rounded-soft border border-dashed border-line p-6">
            <h2 className="font-display text-xl">{sections.donate.title}</h2>
            <p className="mt-2 text-sm text-muted">{sections.donate.body}</p>
          </article>
          <article id="volunteer" className="rounded-soft border border-dashed border-line p-6">
            <h2 className="font-display text-xl">{sections.volunteer.title}</h2>
            <p className="mt-2 text-sm text-muted">{sections.volunteer.body}</p>
          </article>
        </div>
      </section>
    </>
  );
}
