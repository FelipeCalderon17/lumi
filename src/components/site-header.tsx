import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n";
import { LanguageSwitch } from "./language-switch";
import { LumiMark } from "./lumi-mark";
import { navItems } from "./nav-items";
import { DesktopNav, MobileNav } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({ locale, t }: { locale: Locale; t: Dictionary }) {
  const items = navItems(locale, t);
  return (
    <header className="relative z-20 print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
        <Link href={`/${locale}`} className="flex min-h-11 items-center gap-2 text-text">
          <LumiMark className="size-9" />
          <span className="font-display text-[1.7rem] leading-none tracking-tight">Lumi</span>
        </Link>
        <DesktopNav items={items} label={t.nav.label} />
        <div className="flex items-center gap-2">
          <LanguageSwitch
            locale={locale}
            label={t.nav.switchLanguage}
            ariaLabel={t.nav.switchLanguageLabel}
          />
          <ThemeToggle toDawn={t.nav.themeToDawn} toNight={t.nav.themeToNight} />
          <MobileNav
            items={items}
            label={t.nav.label}
            menu={t.nav.menu}
            closeMenu={t.nav.closeMenu}
          />
        </div>
      </div>
    </header>
  );
}
