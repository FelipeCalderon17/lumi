import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VolunteerBoard } from "@/components/demo/volunteer-board";
import { DemoBadge } from "@/components/safety-card";
import { getDictionary, isLocale } from "@/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/volunteer">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).volunteer.title } : {};
}

export default async function VolunteerPage({ params }: PageProps<"/[locale]/volunteer">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return (
    <section className="mx-auto max-w-6xl px-5 pt-8 sm:pt-12">
      <div className="max-w-3xl">
        <DemoBadge label={t.common.demo} />
        <h1 className="mt-4 text-5xl leading-tight sm:text-6xl">{t.volunteer.title}</h1>
        <p className="mt-4 text-[1.15rem] text-muted">{t.volunteer.lede}</p>
        <p className="mt-4 text-[0.98rem] text-muted">{t.volunteer.demoNote}</p>
      </div>
      <VolunteerBoard t={t} />
    </section>
  );
}
