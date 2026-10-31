import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n";
import { LumiMark } from "./lumi-mark";
import { navItems } from "./nav-items";

/**
 * The demo disclaimer, and the ONLY place a fictional contact number may appear (555-01xx,
 * enforced by the dictionary tests). Never in safety or fallback copy.
 */
export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <footer className="mt-24 border-t border-line/70 print:hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 text-[0.98rem] sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LumiMark className="size-8" />
            <span className="font-display text-2xl tracking-tight">Lumi</span>
          </div>
          <p className="font-display text-lg text-muted italic">{t.footer.tagline}</p>
          <p className="max-w-sm font-semibold text-text">{t.footer.fictional}</p>
        </div>
        <nav aria-label={t.footer.exploreTitle}>
          <h2 className="eyebrow">{t.footer.exploreTitle}</h2>
          <ul className="mt-3 space-y-1">
            {navItems(locale, t)
              .slice(1)
              .map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-9 items-center text-muted hover:text-text"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
        <div>
          <h2 className="eyebrow">{t.footer.contactTitle}</h2>
          <ul className="mt-3 space-y-1 text-muted">
            <li>{t.footer.contactEmail}</li>
            <li>{t.footer.contactPhone}</li>
            <li>{t.footer.contactHours}</li>
          </ul>
          <Link
            href={`/${locale}/staff`}
            className="mt-6 inline-flex min-h-9 items-center text-sm text-muted underline-offset-4 hover:text-text hover:underline"
          >
            {t.footer.staff}
          </Link>
        </div>
      </div>
      <div className="border-t border-line/50">
        <p className="mx-auto max-w-6xl px-5 py-5 text-sm text-muted">{t.footer.credit}</p>
      </div>
    </footer>
  );
}
