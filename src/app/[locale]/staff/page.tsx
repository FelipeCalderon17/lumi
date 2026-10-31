import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffArea } from "@/components/staff/staff-area";
import { getDictionary, isLocale } from "@/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff">): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: isLocale(locale) ? getDictionary(locale).staff.title : undefined,
    robots: { index: false, follow: false },
  };
}

/** Staff area (ADR 0008). The data comes from the session-checked, no-store staff API. */
export default async function StaffPage({ params }: PageProps<"/[locale]/staff">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return (
    <section className="mx-auto max-w-5xl px-5 pt-8 sm:pt-12">
      <h1 className="text-5xl leading-tight sm:text-6xl">{t.staff.title}</h1>
      <StaffArea locale={locale} t={t} />
    </section>
  );
}
