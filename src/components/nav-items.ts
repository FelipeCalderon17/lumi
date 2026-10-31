import type { Dictionary, Locale } from "@/i18n";

export type NavItem = { href: string; label: string };

export function navItems(locale: Locale, t: Dictionary): NavItem[] {
  return [
    { href: `/${locale}`, label: t.nav.home },
    { href: `/${locale}/help`, label: t.nav.help },
    { href: `/${locale}/notebook`, label: t.nav.notebook },
    { href: `/${locale}/guides`, label: t.nav.guides },
    { href: `/${locale}/community`, label: t.nav.community },
    { href: `/${locale}/volunteer`, label: t.nav.volunteer },
    { href: `/${locale}/donate`, label: t.nav.donate },
  ];
}
