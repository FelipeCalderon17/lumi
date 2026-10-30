import type { Locale } from "./config";
import { type Dictionary, en } from "./dictionaries/en";
import { es } from "./dictionaries/es";

const dictionaries: Record<Locale, Dictionary> = { en, es };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export { defaultLocale, isLocale, type Locale, locales } from "./config";
export type { Dictionary };
