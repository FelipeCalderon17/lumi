import type { Language } from "@/server/types";

export const locales = ["en", "es"] as const satisfies readonly Language[];
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Picks a locale from an Accept-Language header. Anything starting with "es" → es. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  const first = acceptLanguage?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("es") ? "es" : defaultLocale;
}
