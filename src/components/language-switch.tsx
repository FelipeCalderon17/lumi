"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";

/** Links to the same page in the other language. */
export function LanguageSwitch({
  locale,
  label,
  ariaLabel,
}: {
  locale: Locale;
  label: string;
  ariaLabel: string;
}) {
  const pathname = usePathname();
  const other: Locale = locale === "en" ? "es" : "en";
  const href = pathname.replace(/^\/(en|es)(?=\/|$)/, `/${other}`);

  return (
    <Link
      href={href}
      hrefLang={other}
      lang={other}
      aria-label={ariaLabel}
      className="rounded-pill border border-line px-3 py-1 text-sm text-muted transition-colors hover:border-glow hover:text-text"
    >
      {label}
    </Link>
  );
}
