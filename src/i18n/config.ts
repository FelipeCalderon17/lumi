import type { Language } from "@/server/types";

export const locales = ["en", "es"] as const satisfies readonly Language[];
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Picks the supported locale with the highest q-weight in an Accept-Language header.
 * Ranges with q=0 are excluded ("not acceptable"); ties keep header order; "es-MX" counts as es.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  let best: { locale: Locale; q: number } | null = null;
  for (const range of acceptLanguage?.split(",") ?? []) {
    const [tag = "", ...params] = range.trim().toLowerCase().split(";");
    const primary = tag.trim().split("-")[0] ?? "";
    if (!isLocale(primary)) continue;
    const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const q = qParam === undefined ? 1 : Number(qParam.slice(2));
    if (!Number.isFinite(q) || q <= 0) continue;
    if (best === null || q > best.q) best = { locale: primary, q };
  }
  return best?.locale ?? defaultLocale;
}
