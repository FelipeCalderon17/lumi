/**
 * Machine-checkable parts of docs/CONTENT-GUIDELINES.md, shared by the KB tests, the
 * dictionary tests and (Phase 4) the eval checks on model output. They catch slips; they
 * don't replace the human review of every article.
 */

/** The only numbers that may be shown as phone numbers: 911 (emergency) and 988 (crisis). */
export const ALLOWED_SERVICE_NUMBERS = ["911", "988"] as const;

/**
 * The one real company content may name: the AI data processor, and only in the privacy
 * disclosures (ADR 0005, CONTENT-GUIDELINES § Truthfulness). Where it may appear is checked by
 * the dictionary and KB tests.
 */
export const AI_PROCESSOR_NAME = /\bOpenAI\b/i;

/** 7+ digits, optionally separated: "555-123-4567", "(555) 123 4567", "1-800-…". */
const PHONE_LIKE = /(?:\+?\d[\s().-]*){7,}/g;
/**
 * US N11 service codes (211, 311 …) other than 911. Not after a word that makes it a room,
 * bed, floor or route number ("room 211", "habitación 311"): those aren't phone numbers.
 */
const N11 =
  /(?<!\b(?:rooms?|suite|floor|apt|apartment|unit|bed|bus|route|gate|building|ward|habitaci[oó]n|cuarto|sala|piso|cama|ruta|autob[uú]s|edificio|no\.?|n[uú]mero de (?:habitaci[oó]n|cuarto))\s?#?\s?)\b[2-8]11\b/giu;

/** Dose units and dose forms, EN + ES, abbreviated and spelled out. */
const DOSE_UNITS =
  "mg|mgs|mcg|µg|ug|ml|mls|cc|iu|ui|milligrams?|micrograms?|millilit(?:er|re)s?|miligramos?|microgramos?|mililitros?|units?|unidades|drops?|gotas?|teaspoons?|tsp|tablespoons?|tbsp|cucharaditas?|cucharadas?|puffs?|inhalaci(?:o|ó)n(?:es)?";
const DOSE_FORMS =
  "tablets?|pills?|capsules?|doses?|tabletas?|pastillas?|comprimidos?|c[aá]psulas?|dosis";
const WRITTEN_QUANTITIES =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half(?: an?)?|a half|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|medio|media";
/** ES "un/una" is also the article "a", and "una tableta" is usually the device. */
const ES_ARTICLE_FORMS =
  "pastillas?|comprimidos?|c[aá]psulas?|dosis|gotas?|cucharaditas?|cucharadas?|inhalaci(?:o|ó)n|miligramos?|microgramos?|mililitros?";

/** A number, digits or written, with a dose unit or form: "5 ml", "5 milligrams", "one tablet". */
const DOSAGE = new RegExp(
  `\\b(?:\\d+(?:[.,]\\d+)?\\s?(?:${DOSE_UNITS}|${DOSE_FORMS})` +
    `|(?:${WRITTEN_QUANTITIES})\\s+(?:of\\s+an?\\s+|de\\s+)?(?:${DOSE_UNITS}|${DOSE_FORMS})` +
    `|(?:un|una)\\s+(?:${ES_ARTICLE_FORMS}))\\b`,
  "giu",
);

/** How often: "every 4 hours", "twice daily", "cada mañana", "dos veces al día". */
const FREQUENCY = new RegExp(
  "\\b(?:(?:every|cada)\\s+(?:\\d+|one|two|three|four|six|eight|twelve|una|dos|tres|cuatro|seis|ocho|doce)\\s+(?:hours?|horas?)" +
    "|(?:once|twice|three times|four times|\\d+ times|una vez|dos veces|tres veces|cuatro veces|\\d+ veces)\\s+(?:a|per|al|por)\\s+(?:day|d[ií]a)" +
    "|(?:once|twice|three times|four times|\\d+ times) daily" +
    "|every (?:morning|night|evening)|cada (?:ma[nñ]ana|noche|tarde))\\b",
  "giu",
);

/**
 * A frequency is only a dosing frequency next to something being dosed, in the same sentence:
 * a dose amount, a medicine word, or "give/take it". So "take a break every 2 hours" and "the
 * tablet every night" (the device) pass, and "give it every 4 hours" doesn't.
 */
const DOSE_CONTEXT =
  /\b(?:medicines?|medications?|meds|syrup|pills?|capsules?|doses?|medicinas?|medicamentos?|jarabe|pastillas?|comprimidos?|dosis|(?:give|take|administer)\s+(?:it|them|one|two|half)|d[aá]selo|d[aá]sela|t[oó]malo|t[oó]mala|d[aá]rselo|t[oó]marlo)\b/iu;

function dosingFrequencies(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .filter((sentence) => DOSE_CONTEXT.test(sentence) || new RegExp(DOSAGE).test(sentence))
    .flatMap((sentence) => [...sentence.matchAll(FREQUENCY)].map((m) => m[0]));
}

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
  for (const match of dosingFrequencies(text)) violations.push({ rule: "dosage", match });
  for (const m of text.matchAll(BANNED_WORDS))
    violations.push({ rule: "banned_word", match: m[0] });
  return violations;
}
