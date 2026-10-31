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
      className="flex min-h-11 items-center rounded-pill border border-line px-4 text-[0.95rem] text-muted transition-colors duration-200 hover:border-glow hover:text-text"
    >
      {label}
    </Link>
  );
}
