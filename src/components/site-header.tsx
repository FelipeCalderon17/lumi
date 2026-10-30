import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n";
import { LanguageSwitch } from "./language-switch";
import { LumiMark } from "./lumi-mark";

export function SiteHeader({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5">
      <Link href={`/${locale}`} className="flex items-center gap-2 text-text">
        <LumiMark className="size-8" />
        <span className="font-display text-2xl tracking-tight">Lumi</span>
      </Link>
      <nav aria-label={t.nav.label} className="flex items-center gap-4 text-sm">
        <Link href={`/${locale}/help`} className="text-muted hover:text-text">
          {t.nav.help}
        </Link>
        <LanguageSwitch
          locale={locale}
          label={t.nav.switchLanguage}
          ariaLabel={t.nav.switchLanguageLabel}
        />
      </nav>
    </header>
  );
}
