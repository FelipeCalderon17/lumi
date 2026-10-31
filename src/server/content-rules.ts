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

/*
 * Dosage gate (Codex re-review 4): STRUCTURAL and FAIL CLOSED, with no list of drug names. The
 * KB has no doses, so a generated answer never needs one. Citation markers are removed first.
 * An answer is withheld if:
 *   1. an ADMINISTRATION verb (give, take, administer, dose, apply, inject, use; da/dale,
 *      toma, administra, aplica, inyecta, usa) is followed by a QUANTITY of any form, or
 *   2. an administration verb (not use/usa) has a FREQUENCY of any form after it, or a
 *      period-based frequency before it in the same sentence ("Every 8 hours, give it"), or
 *   3. a QUANTITY is directly followed by a dose unit or form ("5 ml", "half a tablet", "a
 *      gram", "una unidad", "2 of the pills"), or an unambiguous dose unit stands alone ("mg").
 *   4. (kept from round 3, still drug-name free) a dose unit or form word with a frequency in
 *      the same sentence: "the pills every other day", "las pastillas cada dos días".
 * "After" in 1–2 means the rest of the sentence, or the next DOSE_WINDOW_WORDS words across
 * sentence and line breaks ("Take paracetamol. Every 8 hours"). Only two narrow exemptions: a short list of
 * harmless objects after take/give ("take a break", "toma una siesta", "dale un abrazo"), and an
 * explicit device construction ("a tablet with headphones", "tablet (iPad)", "tableta para
 * juegos") in a sentence with no administration verb and no number before the tablet.
 * The price is some harmless sentences withheld (documented, measured in Phase 4); the parent
 * gets the fallback, never a dose.
 */

/** Not a letter or digit, either side: `\b` is ASCII-only, even with the `u` flag. */
const B = String.raw`(?<![\p{L}\p{N}])`;
const E = String.raw`(?![\p{L}\p{N}])`;

/** Dose units, EN + ES, abbreviated and spelled out. */
const DOSE_UNITS =
  "mg|mgs|mcg|µg|ug|ml|mls|cc|iu|ui|g|gr|grams?|gramos?|milligrams?|micrograms?|millilit(?:er|re)s?|miligramos?|microgramos?|mililitros?|international units?|unidad(?:es)? internacionales|units?|unidad(?:es)?|drops?|gotas?|teaspoons?(?:ful)?|tsp|tablespoons?(?:ful)?|tbsp|cucharaditas?|cucharadas?|puffs?|inhalaci(?:o|ó)n(?:es)?";
/** Dose forms. A tablet is only the device in an explicit construction (see DEVICE_TABLET). */
const DOSE_FORMS =
  "tablets?|pills?|capsules?|doses?|tabletas?|pastillas?|comprimidos?|c[aá]psulas?|dosis";
/** Units that only ever mean a dose, so they're withheld even without a number. */
const BARE_DOSE_UNITS =
  "mg|mgs|mcg|µg|ml|mls|milligrams?|micrograms?|millilit(?:er|re)s?|miligramos?|microgramos?|mililitros?";

/** Written numbers, EN + ES, including ES "once" (11): EN "once" is a count of one anyway. */
const WRITTEN_NUMBERS =
  "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen|half|quarter|once|twice|thrice" +
  "|cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|trece|catorce|quince|dieci\\p{L}+|veinte|veinti\\p{L}+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|\\p{L}+cientos|mil";
/** A digit quantity: optional sign, integer, decimal, fraction ("1/2") or a fraction character. */
const DIGIT_QUANTITY = String.raw`(?:${B}[-+−]?\d+(?:[.,]\d+)*(?:\s?\/\s?\d+)?[½¼¾⅓⅔]?|[½¼¾⅓⅔])`;
/** Written quantity before a unit or form: "twenty", "half a", "a half", "media", "un cuarto de". */
const WRITTEN_QUANTITY = `${B}(?:${WRITTEN_NUMBERS}|half(?: an?)?|a half|a quarter|medio|media|un cuarto|un tercio)`;
/**
 * Articles count as "one" before a unit or form. Not before a compound noun that names an
 * object ("a pill organizer") or a hospital unit ("una unidad de oncología").
 */
const ARTICLE_QUANTITY =
  String.raw`${B}(?:a|an|un|una)\s+(?:${DOSE_UNITS}|${DOSE_FORMS})${E}` +
  String.raw`(?!\s+(?:organi[sz]ers?|box(?:es)?|cases?|reminders?|schedules?|lists?|charts?|bottles?|cutters?|crushers?|de\s+(?:cuidados|oncolog\p{L}*|pediatr\p{L}*|hospitalizaci\p{L}*|trasplante|aislamiento|urgencias|emergencias)))`;

/** Rule 3. */
const DOSAGE = new RegExp(
  `(?:${DIGIT_QUANTITY}\\s*(?:${DOSE_UNITS}|${DOSE_FORMS})${E}` +
    `|${WRITTEN_QUANTITY}\\s+(?:of\\s+an?\\s+|de\\s+)?(?:${DOSE_UNITS}|${DOSE_FORMS})${E}` +
    `|(?:${DIGIT_QUANTITY}|${WRITTEN_QUANTITY})\\s+(?:of\\s+(?:the|your|his|her|their)|de\\s+(?:las|los|sus|tus))\\s+(?:${DOSE_FORMS})${E}` +
    `|${ARTICLE_QUANTITY}` +
    `|${B}(?:${BARE_DOSE_UNITS})${E})`,
  "giu",
);

/*
 * Rules 1–2 work on words with accents stripped and case folded, so the lists below are ASCII.
 */

/** Administration verbs, EN + ES. */
const ADMIN_VERB =
  /^(?:give|gives|giving|gave|given|take|takes|taking|took|taken|administer(?:s|ed|ing)?|dose|doses|dosed|dosing|appl(?:y|ies|ied|ying)|inject(?:s|ed|ing)?|da|dale|dales|dar|darle|darles|dele|deles|denle|dad|dadle|das(?:e|el)(?:o|a|os|as)|dars(?:e|el)(?:o|a|os|as)|tom(?:a|as|ar|e|en|o|ando|ado|ada|alo|ala|alos|alas|arlo|arla|arlos|arlas|ese|arse|ate|elo|ela)|administr\p{L}*|aplic(?:a|as|ar|ale|arle|ando|ado|alo|ala|arlo|arla)|apliqu(?:e|en|ele|enle)|inyect\p{L}*)$/u;
/**
 * use/usa count only with a quantity after them, never with a frequency: "anything you use
 * every day" and "lo que uses a diario" are KB packing lines (and ES "uses" is EN "uses").
 */
const QUANTITY_ONLY_VERB = /^(?:use|uses|used|using|us(?:a|as|ar|e|en|alo|ala|arlo|arla|ando))$/u;
const TAKE_OR_GIVE =
  /^(?:take|takes|taking|took|taken|give|gives|giving|gave|given|tom\p{L}*|d\p{L}*)$/u;
/** Harmless objects after take/give: "take a break", "toma una siesta", "dale un abrazo". */
const HARMLESS_OBJECT =
  /^(?:breaks?|naps?|walks?|rest|photos?|pictures?|showers?|baths?|seats?|snacks?|breaths?|breather|notes?|turns|care|time|leave|hugs?|kiss(?:es)?|descansos?|pausas?|tiempo|permiso|licencia|siestas?|fotos?|fotografias?|duchas?|banos?|asientos?|meriendas?|notas?|apuntes|abrazos?|besos?|respiro|aire|paseos?|caminatas?)$/u;
/** Words allowed between take/give and a harmless object: "take a short break", "take 2 snacks". */
const OBJECT_FILLER =
  /^(?:a|an|the|your|some|un|una|unos|unas|el|la|los|las|tu|tus|them|him|her|yourself|themselves|some|more|les|le|mas|deep|short|quick|little|small|long|pequeno|pequena|corto|corta|breve|buen|buena)$/u;

/** A quantity word for rules 1–2. 911 and 988 are service numbers (ADR 0012). */
const QUANTITY_WORD = new RegExp(
  `^(?:[-+−]?\\d+(?:[.,:/]\\d+)*[½¼¾⅓⅔]?\\p{L}*|[½¼¾⅓⅔]|${WRITTEN_NUMBERS}|medio|media)$`,
  "u",
);
const ARTICLE_WORD = /^(?:a|an|un|una)$/u;
const UNIT_OR_FORM_WORD = new RegExp(`^(?:${DOSE_UNITS}|${DOSE_FORMS})$`, "u");
const SERVICE_NUMBERS = new Set<string>(["911", "988"]);

/** Time periods, for "once a day", "dos veces por semana". */
const PERIOD =
  /^(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?|nights?|mornings?|evenings?|minutos?|horas?|dias?|semanas?|mes(?:es)?|noches?|mananas?|tardes?)$/u;
const TIMES_WORD = /^(?:once|twice|thrice|times|vez|veces)$/u;
const PER_WORD = /^(?:a|an|per|al|por|each|every|cada|la|el)$/u;
/** Frequencies on their own: "daily", "diariamente". */
const FREQUENCY_WORD =
  /^(?:daily|nightly|hourly|weekly|diario|diaria|diarios|diarias|diariamente|semanal|semanalmente)$/u;

/** How many words apart a verb and a quantity or frequency may be across sentence breaks. */
const DOSE_WINDOW_WORDS = 12;

const CITATION_MARKER = /\[\d+(?:\s*,\s*\d+)*\]/g;
/** Sentence breaks; a dot between digits ("2.5") isn't one. */
const SENTENCE_BREAK = /[!?\n;]+|\.(?!\d)/;
/** A word; a sign counts only when it starts a number ("-5"), not in "twenty-five". */
const WORD = /(?:(?<![\p{L}\p{N}])[-+−](?=\p{N}))?[\p{L}\p{N}½¼¾⅓⅔]+(?:[.,/:]\p{N}+)*/gu;

/**
 * The only device exemption: an explicit construction. "tablet (iPad)", "tablet computer",
 * "tableta electrónica", or a tablet followed by with/or/for/con/para… and a screen or audio
 * word ("a tablet with headphones", "una tableta para juegos").
 */
const DEVICE_TABLET = new RegExp(
  String.raw`${B}(?:tablets?|tabletas?)(?=\s*\(\s*ipad\s*\)|\s+(?:computers?|devices?|electr[oó]nicas?)${E}|\s+(?:with|or|and|for|to|con|o|y|para)\s+(?:watch\s+|ver\s+|jugar\s+)?(?:headphones|earbuds|aud[ií]fonos|auriculares|juegos|games|videos|v[ií]deos|pel[ií]culas|movies|films|cartoons|dibujos|shows|series|m[uú]sica|music|apps|aplicaciones|ebooks|libros electr[oó]nicos)${E})`,
  "giu",
);

const fold = (word: string) =>
  word
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();

type DoseWord = { word: string; sentence: number };

function isQuantityAt(words: readonly DoseWord[], i: number): boolean {
  const w = words[i]?.word ?? "";
  if (SERVICE_NUMBERS.has(w)) return false;
  if (QUANTITY_WORD.test(w)) return true;
  return ARTICLE_WORD.test(w) && UNIT_OR_FORM_WORD.test(words[i + 1]?.word ?? "");
}

/**
 * A frequency at word i. After a verb, "every/each/cada" + anything counts. Before a verb
 * (`strict`), only a period does: "every 8 hours, give…" counts, "different for every child …
 * can give you that list" (a KB line) doesn't.
 */
function isFrequencyAt(words: readonly DoseWord[], i: number, strict: boolean): boolean {
  const [w, next, after] = [words[i]?.word, words[i + 1]?.word, words[i + 2]?.word];
  if (w === undefined) return false;
  if (FREQUENCY_WORD.test(w)) return true;
  if ((w === "every" || w === "each" || w === "cada") && next !== undefined) {
    if (!strict) return true;
    const counted = QUANTITY_WORD.test(next) || /^(?:other|few|otro|otra|pocos|pocas)$/u.test(next);
    return PERIOD.test(next) || (counted && after !== undefined && PERIOD.test(after));
  }
  // "once a day", "twice per week", "3 times a day", "dos veces al día", "una vez por semana".
  if (TIMES_WORD.test(w) && next !== undefined && PER_WORD.test(next)) {
    return (
      PERIOD.test(next) ||
      (after !== undefined && PERIOD.test(after)) ||
      PERIOD.test(words[i + 3]?.word ?? "")
    );
  }
  // "a day", "al día", "per day", "por día".
  return (w === "a" || w === "al" || w === "per" || w === "por") && next !== undefined
    ? /^(?:day|dia|night|noche)$/u.test(next)
    : false;
}

/** "take a break", "toma una siesta", "take 2 snacks": the verb isn't administering anything. */
function hasHarmlessObject(words: readonly DoseWord[], i: number): boolean {
  if (!TAKE_OR_GIVE.test(words[i]?.word ?? "")) return false;
  for (let j = i + 1; j <= i + 3 && j < words.length; j++) {
    const w = words[j]?.word ?? "";
    if (HARMLESS_OBJECT.test(w)) return true;
    if (!OBJECT_FILLER.test(w) && !QUANTITY_WORD.test(w)) return false;
  }
  return false;
}

/** Device tablets in sentences with no administration verb and no number right before them. */
function maskDeviceTablets(sentence: string): string {
  const words = [...sentence.matchAll(WORD)].map((m) => fold(m[0]));
  if (words.some((w) => ADMIN_VERB.test(w) || QUANTITY_ONLY_VERB.test(w))) return sentence;
  return sentence.replace(DEVICE_TABLET, (tablet, at: number) => {
    const before = [...sentence.slice(0, at).matchAll(WORD)].map((m) => fold(m[0]));
    // "2 tablets", "half a tablet": a quantity, whatever follows. A bare article is fine.
    const last = before.at(-1) ?? "";
    const quantity =
      QUANTITY_WORD.test(last) ||
      (ARTICLE_WORD.test(last) && QUANTITY_WORD.test(before.at(-2) ?? ""));
    return quantity ? tablet : "device".padEnd(tablet.length, "_");
  });
}

/** Every dosage match, most specific rule first. */
function dosageMatches(text: string): string[] {
  const sentences = text.replace(CITATION_MARKER, " ").split(SENTENCE_BREAK).map(maskDeviceTablets);
  const matches = sentences.flatMap((s) => [...s.matchAll(DOSAGE)].map((m) => m[0]));
  const words: DoseWord[] = sentences.flatMap((s, sentence) =>
    [...s.matchAll(WORD)].map((m) => ({ word: fold(m[0]), sentence })),
  );
  const sameSentence = (i: number, j: number) => words[i]?.sentence === words[j]?.sentence;
  for (const [i, { word }] of words.entries()) {
    const quantityOnly = QUANTITY_ONLY_VERB.test(word);
    if (!ADMIN_VERB.test(word) && !quantityOnly) continue;
    if (hasHarmlessObject(words, i)) continue;
    // After the verb: the same sentence, or the next DOSE_WINDOW_WORDS across breaks.
    for (let j = i + 1; j < words.length; j++) {
      if (j - i > DOSE_WINDOW_WORDS && !sameSentence(i, j)) break;
      if (isQuantityAt(words, j) || (!quantityOnly && isFrequencyAt(words, j, false))) {
        matches.push(`${word} … ${words[j]?.word}`);
        break;
      }
    }
    // Before the verb, in the same sentence: "Every 8 hours, give it".
    if (quantityOnly) continue;
    for (let j = i - 1; j >= 0 && sameSentence(i, j); j--) {
      if (isFrequencyAt(words, j, true)) {
        matches.push(`${words[j]?.word} … ${word}`);
        break;
      }
    }
  }
  // Rule 4: a dose unit or form with a frequency in the same sentence.
  for (const [i, { word }] of words.entries()) {
    if (!UNIT_OR_FORM_WORD.test(word)) continue;
    const j = words.findIndex((_, k) => sameSentence(i, k) && isFrequencyAt(words, k, true));
    if (j !== -1) matches.push(`${word} … ${words[j]?.word}`);
  }
  return matches;
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
  for (const match of dosageMatches(text)) violations.push({ rule: "dosage", match });
  for (const m of text.matchAll(BANNED_WORDS))
    violations.push({ rule: "banned_word", match: m[0] });
  return violations;
}
