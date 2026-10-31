/**
 * Donate page logic. The "what your donation funds" copy is a FIXED, human-written table in the
 * dictionaries (`donate.impact`), labelled illustrative. No AI is involved, and no payment is
 * processed (demo).
 */

export const DONATION_PRESETS = [25, 50, 100, 250] as const;
export type ImpactTier = (typeof DONATION_PRESETS)[number];

/** Largest custom amount the demo form accepts, in whole dollars. */
export const MAX_DONATION = 100_000;

/**
 * The illustrative tier for an amount: the largest preset at or below it. Amounts under the
 * smallest preset map to "small" (a general "every gift helps" line). Invalid → null.
 */
export function impactTierFor(amount: number): ImpactTier | "small" | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  let tier: ImpactTier | "small" = "small";
  for (const preset of DONATION_PRESETS) if (amount >= preset) tier = preset;
  return tier;
}

/** "$40", "40", "40.00" → 40. Whole dollars only, 1..MAX_DONATION; anything else → null. */
export function parseCustomAmount(input: string): number | null {
  const match = /^\s*\$?\s*(\d{1,6})(?:\.0{1,2})?\s*$/.exec(input);
  if (!match) return null;
  const amount = Number(match[1]);
  return amount >= 1 && amount <= MAX_DONATION ? amount : null;
}
