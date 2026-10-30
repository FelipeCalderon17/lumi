import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/i18n";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Shell for the staff gaps view (Phase 3, ADR 0008). */
export default async function StaffGapsPage({ params }: PageProps<"/[locale]/staff/gaps">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <section className="max-w-2xl space-y-6 py-12">
      <h1 className="font-display text-4xl tracking-tight">{t.staff.gapsTitle}</h1>
      <p className="text-muted">{t.staff.gapsLede}</p>
      <div className="rounded-soft border border-dashed border-line p-6 text-muted">
        {t.staff.placeholder}
      </div>
    </section>
  );
}
