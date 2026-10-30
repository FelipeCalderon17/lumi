import { notFound } from "next/navigation";
import { EmergencyBanner } from "@/components/emergency-banner";
import { getDictionary, isLocale } from "@/i18n";

/** Shell for the Family Support Assistant (Phase 1–2). */
export default async function HelpPage({ params }: PageProps<"/[locale]/help">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <section className="max-w-2xl space-y-6 py-12">
      <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{t.help.title}</h1>
      <p className="text-muted">{t.help.lede}</p>
      <EmergencyBanner lines={[t.emergency.banner, t.emergency.crisisBanner, t.safety.outsideUs]} />
      <p className="text-sm text-muted">{t.help.boundaries}</p>
      <p className="text-sm text-muted">{t.help.processingNotice}</p>
      <div className="rounded-soft border border-dashed border-line p-6 text-muted">
        {t.help.placeholder}
      </div>
    </section>
  );
}
