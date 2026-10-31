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
 * Dosage gate (Codex re-review 3): FAIL CLOSED. The KB has no doses, so a generated answer
 * never needs one. Three layers, all per sentence, after citation markers are removed and
 * device tablets ("a tablet with headphones", "una tableta para juegos") are masked:
 *   1. DOSAGE: a quantity next to a dose unit or form ("5 ml", "twenty milligrams", "1/2
 *      tablet", "una unidad", "a tablet"), or an unambiguous dose unit on its own ("mg").
 *   2. FREQUENCY next to anything being dosed ("medicine twice a week", "cada 30 minutos").
 *   3. WINDOW: a medicine word within a few words of ANY quantity (digit, decimal, fraction,
 *      written number, "half"), even if layers 1–2 don't recognise the phrasing.
 * The price is some harmless sentences withheld ("medicine list … every 2 hours"); the
 * parent gets the fallback, never a dose.
 */

/** Not a letter or digit, either side: `\b` is ASCII-only, even with the `u` flag. */
const B = String.raw`(?<![\p{L}\p{N}])`;
const E = String.raw`(?![\p{L}\p{N}])`;

/** Dose units, EN + ES, abbreviated and spelled out. */
const DOSE_UNITS =
  "mg|mgs|mcg|µg|ug|ml|mls|cc|iu|ui|g|gr|grams?|gramos?|milligrams?|micrograms?|millilit(?:er|re)s?|miligramos?|microgramos?|mililitros?|units?|unidad(?:es)?|drops?|gotas?|teaspoons?|tsp|tablespoons?|tbsp|cucharaditas?|cucharadas?|puffs?|inhalaci(?:o|ó)n(?:es)?";
/** Dose forms. "tablet"/"tableta" counts unless the sentence shows it's the device. */
const DOSE_FORMS =
  "tablets?|pills?|capsules?|doses?|tabletas?|pastillas?|comprimidos?|c[aá]psulas?|dosis";
/** Units that only ever mean a dose, so they're withheld even without a number. */
const BARE_DOSE_UNITS =
  "mg|mgs|mcg|µg|ml|mls|milligrams?|micrograms?|millilit(?:er|re)s?|miligramos?|microgramos?|mililitros?";

/** Written numbers, EN + ES. Not "once" (EN "once you arrive") or "cuarto" (a room). */
const WRITTEN_NUMBERS =
  "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen|half|quarter" +
  "|cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|trece|catorce|quince|dieci\\p{L}+|veinte|veinti\\p{L}+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|mil";
/** A digit quantity: integer, decimal, fraction ("1/2") or a fraction character. */
const DIGIT_QUANTITY = String.raw`(?:${B}\d+(?:[.,]\d+)?(?:\s?\/\s?\d+)?|[½¼¾⅓⅔])`;
/** Written quantity before a unit or form: "twenty", "half a", "a half", "media", "un cuarto de". */
const WRITTEN_QUANTITY = `${B}(?:${WRITTEN_NUMBERS}|half(?: an?)?|a half|a quarter|medio|media|un cuarto|un tercio)`;
/** Articles count as "one" before a form or unit. EN "a pill organizer" is an object, not a dose. */
const ARTICLE_QUANTITY =
  String.raw`${B}(?:(?:un|una)\s+(?:${DOSE_FORMS}|${DOSE_UNITS}|cucharad\p{L}*)(?!\s+de\s+(?:cuidados|oncolog\p{L}*|pediatr\p{L}*|hospitalizaci\p{L}*|trasplante|aislamiento|urgencias|emergencias))` +
  String.raw`|(?:a|an)\s+(?:${DOSE_FORMS})(?!\s+(?:organi[sz]ers?|box(?:es)?|cases?|reminders?|schedules?|lists?|charts?|bottles?|cutters?|crushers?)))${E}`;

const DOSAGE = new RegExp(
  `(?:${DIGIT_QUANTITY}\\s?(?:${DOSE_UNITS}|${DOSE_FORMS})${E}` +
    `|${WRITTEN_QUANTITY}\\s+(?:of\\s+an?\\s+|de\\s+)?(?:${DOSE_UNITS}|${DOSE_FORMS})${E}` +
    `|${ARTICLE_QUANTITY}` +
    `|${B}(?:${BARE_DOSE_UNITS})${E})`,
  "giu",
);

/** Time units for frequencies, EN + ES. */
const PERIODS =
  "minutes?|mins?|hours?|hrs?|days?|weeks?|months?|nights?|minutos?|horas?|d[ií]as?|semanas?|mes(?:es)?|noches?";
/** How often: "every 4 hours", "cada 30 minutos", "twice a week", "dos veces al día". */
const FREQUENCY = new RegExp(
  `${B}(?:(?:every|cada)\\s+(?:(?:\\d+(?:[.,]\\d+)?|other|few|couple of|${WRITTEN_NUMBERS}|once)\\s+)?(?:${PERIODS})` +
    `|(?:once|twice|thrice|(?:\\d+|${WRITTEN_NUMBERS}) times|una vez|(?:\\d+|${WRITTEN_NUMBERS}) veces)\\s+(?:(?:a|per|al|por|each|every|a la|cada)\\s+)?(?:day|week|month|night|d[ií]a|semana|mes|noche)` +
    `|(?:once|twice|thrice|(?:\\d+|${WRITTEN_NUMBERS}) times)\\s+(?:daily|weekly|nightly)` +
    `|every (?:morning|night|evening)|cada (?:ma[nñ]ana|noche|tarde))${E}`,
  "giu",
);

/** One medicine-ish word. Device tablets are masked before this runs. */
const MEDICINE_WORD =
  /^(?:medicines?|medications?|meds?|pills?|tablets?|capsules?|doses?|dosage|dosing|drops|syrups?|paracetamol|acetaminophen|ibuprofen|aspirin|antibiotics?|medicinas?|medicamentos?|pastillas?|tabletas?|comprimidos?|c[aá]psulas?|dosis|gotas|jarabes?|acetaminof[eé]n|ibuprofeno|aspirinas?|antibi[oó]ticos?)$/iu;

/**
 * Something being dosed, for frequencies: a medicine word, or "give/take it". So "take a
 * break every 2 hours" passes, and "give it every 4 hours" doesn't.
 */
const DOSE_VERB =
  /(?<![\p{L}\p{N}])(?:(?:give|take|administer)\s+(?:it|them|one|two|half)|d[aá]selo|d[aá]sela|t[oó]malo|t[oó]mala|d[aá]rselo|t[oó]marlo)(?![\p{L}\p{N}])/iu;

/** Words that make a nearby "tablet"/"tableta" the device: movies, games, headphones… */
const DEVICE_WORD =
  /^(?:ipads?|pel[ií]culas?|movies?|films?|juegos?|games?|videos?|v[ií]deos?|shows?|series|cartoons?|dibujos|apps?|aplicaciones|m[uú]sica|music|cargador(?:es)?|chargers?|wifi|pantallas?|screens?|headphones|earbuds|aud[ií]fonos|auriculares|entretenimiento|entertainment|ebooks?)$/iu;
const TABLET_WORD = /^(?:tablets?|tabletas?)$/iu;

/** A quantity token for the window check. 911 and 988 are service numbers (ADR 0012). */
const QUANTITY_TOKEN = new RegExp(
  `^(?:(?:\\d+(?:[.,]\\d+)?(?:/\\d+)?)\\p{L}*|[½¼¾⅓⅔]|${WRITTEN_NUMBERS})$`,
  "iu",
);
const SERVICE_NUMBERS = new Set<string>(["911", "988"]);

/** How many words apart a medicine word and a quantity may be and still count. */
const DOSE_WINDOW_WORDS = 6;

const CITATION_MARKER = /\[\d+(?:\s*,\s*\d+)*\]/g;
/** Sentence breaks; a dot between digits ("2.5") isn't one. */
const SENTENCE_BREAK = /[!?\n]+|\.(?!\d)/;
const WORD = /[\p{L}\p{N}½¼¾⅓⅔]+(?:[.,/]\p{N}+)*/gu;

/**
 * Replace each "tablet"/"tableta" that has a device word nearby, and no number right before
 * it, with a neutral word.
 */
function maskDeviceTablets(sentence: string): string {
  const words = [...sentence.matchAll(WORD)];
  const devices = words.flatMap((w, i) => (DEVICE_WORD.test(w[0]) ? [i] : []));
  if (devices.length === 0) return sentence;
  let masked = sentence;
  for (const [i, w] of words.entries()) {
    if (!TABLET_WORD.test(w[0])) continue;
    // "2 tablets" is a quantity whatever else the sentence mentions.
    if (i > 0 && QUANTITY_TOKEN.test(words[i - 1]?.[0] ?? "")) continue;
    if (!devices.some((d) => Math.abs(d - i) <= DOSE_WINDOW_WORDS)) continue;
    const at = w.index ?? 0;
    masked = `${masked.slice(0, at)}${"device".padEnd(w[0].length, "_")}${masked.slice(at + w[0].length)}`;
  }
  return masked;
}

/** Layer 3: "medicine … 2", "pastillas … tres", within DOSE_WINDOW_WORDS. */
function medicineNearQuantity(sentence: string): string | null {
  const words = [...sentence.matchAll(WORD)].map((m) => m[0]);
  for (const [i, word] of words.entries()) {
    if (!MEDICINE_WORD.test(word)) continue;
    const from = Math.max(0, i - DOSE_WINDOW_WORDS);
    const near = words.slice(from, i + DOSE_WINDOW_WORDS + 1);
    const quantity = near.find((w) => QUANTITY_TOKEN.test(w) && !SERVICE_NUMBERS.has(w));
    if (quantity !== undefined) return `${word} … ${quantity}`;
  }
  return null;
}

function hasMedicineWord(sentence: string): boolean {
  return [...sentence.matchAll(WORD)].some((m) => MEDICINE_WORD.test(m[0]));
}

/** Every dosage match, per sentence, most specific layer first. */
function dosageMatches(text: string): string[] {
  const matches: string[] = [];
  for (const raw of text.replace(CITATION_MARKER, " ").split(SENTENCE_BREAK)) {
    const sentence = maskDeviceTablets(raw);
    const doses = [...sentence.matchAll(DOSAGE)].map((m) => m[0]);
    const dosed = doses.length > 0 || hasMedicineWord(sentence) || DOSE_VERB.test(sentence);
    const frequencies = dosed ? [...sentence.matchAll(FREQUENCY)].map((m) => m[0]) : [];
    matches.push(...doses, ...frequencies);
    if (doses.length === 0 && frequencies.length === 0) {
      const near = medicineNearQuantity(sentence);
      if (near !== null) matches.push(near);
    }
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
