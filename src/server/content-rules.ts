/**
 * Machine-checkable parts of docs/CONTENT-GUIDELINES.md, shared by the KB tests, the
 * dictionary tests and (Phase 4) the eval checks on model output. They catch slips; they
 * don't replace the human review of every article.
 */

/** The only numbers that may be shown as phone numbers: 911 (emergency) and 988 (crisis). */
export const ALLOWED_SERVICE_NUMBERS = ["911", "988"] as const;

/** 7+ digits, optionally separated: "555-123-4567", "(555) 123 4567", "1-800-…". */
const PHONE_LIKE = /(?:\+?\d[\s().-]*){7,}/g;
/** US N11 service codes (211, 311 …) other than 911. */
const N11 = /\b[2-8]11\b/g;

const DOSAGE =
  /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|ml|cc|units?|unidades|gotas|drops|tablets?|pastillas?|c[aá]psulas?|capsules?|teaspoons?|cucharaditas?)\b/giu;
const FREQUENCY = /\b(?:every\s+\d+\s+hours?|cada\s+\d+\s+horas?)\b/giu;

/** Medical-claim and tone words the guidelines ban, EN + ES. Whole words, case-insensitive. */
const BANNED_WORDS =
  /\b(?:cure[sd]?|curing|guarantee[sd]?|cura|curar|curación|garantiza(?:r|do|da|mos)?|garantía|journey|warriors?|guerrer[oa]s?|everything happens for a reason|todo pasa por algo)\b/giu;

export type ContentViolation = { rule: "phone_number" | "dosage" | "banned_word"; match: string };

export function findContentViolations(text: string): ContentViolation[] {
  const violations: ContentViolation[] = [];
  for (const m of text.matchAll(PHONE_LIKE)) {
    violations.push({ rule: "phone_number", match: m[0].trim() });
  }
  for (const m of text.matchAll(N11)) violations.push({ rule: "phone_number", match: m[0] });
  for (const m of text.matchAll(DOSAGE)) violations.push({ rule: "dosage", match: m[0] });
  for (const m of text.matchAll(FREQUENCY)) violations.push({ rule: "dosage", match: m[0] });
  for (const m of text.matchAll(BANNED_WORDS))
    violations.push({ rule: "banned_word", match: m[0] });
  return violations;
}
