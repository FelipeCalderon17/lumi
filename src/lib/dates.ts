import type { Language } from "@/server/types";

/**
 * Dates on the notebook page. A note's `createdAt` carries the offset of the device that wrote
 * it ("2026-10-28T23:10:00-05:00"), so we show THAT wall-clock date and time, not the viewer's
 * time zone's reading of the instant. A note written at 11 p.m. stays "Oct 28, 11:10 PM".
 */
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function wallClock(createdAt: string): Date | null {
  const m = WALL_CLOCK.exec(createdAt);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  return new Date(Date.UTC(y, mo - 1, d, h, mi));
}

const intlLocale: Record<Language, string> = { en: "en-US", es: "es-US" };

export function formatNoteDate(createdAt: string, locale: Language): string {
  const date = wallClock(createdAt);
  if (!date) return createdAt;
  return new Intl.DateTimeFormat(intlLocale[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

/** A plain date (no time), e.g. for the printed page header or a staff list. */
export function formatDay(date: Date, locale: Language): string {
  return new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: "long" }).format(date);
}
