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
 * Dosage gate: STRUCTURAL and FAIL CLOSED, in layers, with no list of drug names (ADR 0015). The
 * KB has no doses, so a generated answer never needs one, and withholding a harmless answer is
 * the accepted price (the parent gets the fallback, never a dose). Citation markers are removed
 * first. An answer is withheld if:
 *   1. an ADMINISTRATION verb (give, take, administer, dose, apply, inject; da/dale, toma,
 *      administra, aplica, inyecta) is followed by a QUANTITY of any form, or
 *   2. an administration verb has a FREQUENCY or a SCHEDULE ("at bedtime", "por la mañana")
 *      after it, or a period-based frequency or a schedule before it in the same sentence
 *      ("Every 8 hours, give it"; "At bedtime, give it"), or
 *   3. a QUANTITY is directly followed by a dose unit or form ("5 ml", "half a tablet", "a
 *      gram", "una unidad", "2 of the pills"), or an unambiguous dose unit or a clinical
 *      frequency abbreviation stands alone ("mg", "q6h").
 * Verb-independent backstops (Codex re-review 5), so a verbless line can't carry a dose:
 *   a. MEDICATION CONTEXT (medicine, meds, drug, prescription, medicamento, remedio…, a dose
 *      form or a dose unit) with a quantity, frequency or schedule: "his meds three times weekly",
 *      "Capsules.\nTwice daily", "Take medicine at bedtime".
 *   b. a QUANTITY with a FREQUENCY, no medication word needed: "Paracetamol 500 every 6 hours",
 *      "5 — twice daily". The numbers inside a frequency ("every 2 hours") don't count.
 *   c. LABEL / LIST fragments (Codex re-review 6: whatever follows the value). A label is a
 *      clause of up to 4 words before a separator. After a strong separator (: — – | or a
 *      spaced hyphen), a value that STARTS with a quantity, frequency or schedule is withheld,
 *      whatever follows it ("Paracetamol: half as needed", "Morphine: ½ as needed"). After a
 *      comma, the value must be a run of quantity, frequency or schedule words that ends the
 *      clause or is followed by a condition ("Acetaminophen, half if needed"). With no
 *      separator: up to 2 words and such a run with a frequency or schedule in it
 *      ("Paracetamol every 6 hours", "Paracetamol at night if needed").
 *   d. use/usa count like the other verbs once something sits between the verb and the
 *      frequency or schedule ("Use insulin daily", "Usa insulina diariamente"), and a
 *      frequency or schedule BEFORE them counts as for any verb ("At bedtime, use it"). Right
 *      after the verb, the frequency belongs to a relative clause ("anything you use every
 *      day", "lo que uses a diario": KB lines). Anything later counts, also after a neuter
 *      relative object ("Use whatever was prescribed every morning"); "mantener al día" (up to
 *      date) isn't a frequency (Codex verification).
 *   e. LIST SCOPE: a short heading line (up to 4 words, or ending in a colon) and the next
 *      LIST_SCOPE_LINES lines that are list items (- • * 1. 1)) or bare lines are one scope: an
 *      item that starts with a quantity, frequency or schedule is withheld ("Paracetamol\n-
 *      half\n- at bedtime", "ibuprofeno\nmedia\npor la noche").
 * Before any of this the text is normalised (NFKC, every Unicode decimal digit to ASCII, the
 * fraction slash to "/", dotted clinical abbreviations like "b.i.d." to "bid"), so "Give ٢" and
 * "Medication: ２" are read as "Give 2" and "Medication: 2".
 * This is a FINITE detector: phrasings outside its vocabulary still pass (EVALS.md, Tracked
 * limitations). The KB and the prompt are the first layers, not this check.
 * "After" means the rest of the sentence or the next DOSE_WINDOW_WORDS words across sentence and
 * line breaks. "Before" (a, b) means the same sentence, or a nearby fragment that is nothing but
 * quantity, frequency or schedule words ("Twice daily.\nCapsules"). Narrow exemptions only: a
 * harmless object after take/give, with the frequency right after it ("take a break every 2
 * hours", "toma una siesta", "dale un abrazo"); an explicit device construction ("a tablet with
 * headphones", "tablet (iPad)", "tableta para juegos") in a sentence with no administration
 * verb and no number before the tablet; and the service numbers 911 and 988.
 */

/** Not a letter or digit, either side: `\b` is ASCII-only, even with the `u` flag. */
const B = String.raw`(?<![\p{L}\p{N}])`;
const E = String.raw`(?![\p{L}\p{N}])`;

/** Dose units, EN + ES, abbreviated and spelled out. */
export const DOSE_UNITS =
  "mg|mgs|mcg|µg|μg|ug|ml|mls|cc|iu|ui|g|gr|grams?|gramos?|milligrams?|micrograms?|millilit(?:er|re)s?|miligramos?|microgramos?|mililitros?|international units?|unidad(?:es)? internacionales|units?|unidad(?:es)?|drops?|gotas?|teaspoons?(?:ful)?|tsp|tablespoons?(?:ful)?|tbsp|cucharaditas?|cucharadas?|puffs?|inhalaci(?:o|ó)n(?:es)?";
/** Dose forms. A tablet is only the device in an explicit construction (see DEVICE_TABLET). */
export const DOSE_FORMS =
  "tablets?|pills?|capsules?|doses?|tabletas?|pastillas?|comprimidos?|c[aá]psulas?|dosis";
/** Units that only ever mean a dose, so they're withheld even without a number. */
const BARE_DOSE_UNITS =
  "mg|mgs|mcg|µg|μg|ml|mls|milligrams?|micrograms?|millilit(?:er|re)s?|miligramos?|microgramos?|mililitros?";

/** Written numbers, EN + ES, including ES "once" (11): EN "once" is a count of one anyway. */
export const WRITTEN_NUMBERS =
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
const COMPOUND_OBJECT =
  "organi[sz]ers?|box(?:es)?|cases?|reminders?|schedules?|lists?|charts?|bottles?|cutters?|crushers?";
const HOSPITAL_UNIT =
  "cuidados|oncolog\\p{L}*|pediatr\\p{L}*|hospitalizaci\\p{L}*|trasplante|aislamiento|urgencias|emergencias";
const ARTICLE_QUANTITY =
  String.raw`${B}(?:a|an|un|una)\s+(?:${DOSE_UNITS}|${DOSE_FORMS})${E}` +
  String.raw`(?!\s+(?:${COMPOUND_OBJECT}|de\s+(?:${HOSPITAL_UNIT})))`;

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
 * The word-level rules work on words with accents stripped and case folded, so the lists below
 * are ASCII.
 */

/** Administration verbs, EN + ES. */
const ADMIN_VERB =
  /^(?:give|gives|giving|gave|given|take|takes|taking|took|taken|administer(?:s|ed|ing)?|dose|doses|dosed|dosing|appl(?:y|ies|ied|ying)|inject(?:s|ed|ing)?|da|dale|dales|dar|darle|darles|dele|deles|denle|dad|dadle|das(?:e|el)(?:o|a|os|as)|dars(?:e|el)(?:o|a|os|as)|tom(?:a|as|ar|e|en|o|ando|ado|ada|alo|ala|alos|alas|arlo|arla|arlos|arlas|ese|arse|ate|elo|ela)|administr\p{L}*|aplic(?:a|as|ar|ale|arle|ando|ado|alo|ala|arlo|arla)|apliqu(?:e|en|ele|enle)|inyect\p{L}*)$/u;
/**
 * use/usa: a quantity after them always counts; a frequency or schedule counts only with
 * something between ("Use insulin daily"), not right after ("anything you use every day", "lo
 * que uses a diario": KB packing lines). ES "uses" is also EN "uses".
 */
const USE_VERB = /^(?:use|uses|used|using|us(?:a|as|ar|e|en|alo|ala|arlo|arla|ando))$/u;
const TAKE_OR_GIVE =
  /^(?:take|takes|taking|took|taken|give|gives|giving|gave|given|tom\p{L}*|d\p{L}*)$/u;
/** Harmless objects after take/give: "take a break", "toma una siesta", "dale un abrazo". */
const HARMLESS_OBJECT =
  /^(?:breaks?|naps?|walks?|rest|photos?|pictures?|showers?|baths?|seats?|snacks?|breaths?|breather|notes?|turns|care|time|leave|hugs?|kiss(?:es)?|descansos?|pausas?|tiempo|permiso|licencia|siestas?|fotos?|fotografias?|duchas?|banos?|asientos?|meriendas?|notas?|apuntes|abrazos?|besos?|respiro|aire|paseos?|caminatas?)$/u;
/** Words allowed between take/give and a harmless object: "take a short break", "take 2 snacks". */
const OBJECT_FILLER =
  /^(?:a|an|the|your|some|un|una|unos|unas|el|la|los|las|tu|tus|them|him|her|yourself|themselves|some|more|les|le|mas|deep|short|quick|little|small|long|pequeno|pequena|corto|corta|breve|buen|buena)$/u;

/** A quantity word. 911 and 988 are service numbers (ADR 0012). */
const QUANTITY_WORD = new RegExp(
  `^(?:[-+−]?\\d+(?:[.,:/]\\d+)*[½¼¾⅓⅔]?\\p{L}*|[½¼¾⅓⅔]|${WRITTEN_NUMBERS}|medio|media)$`,
  "u",
);
/** Multiples and "mitad": quantities on their own ("Give double", "Toma la mitad"). */
const MULTIPLE_WORD = /^(?:double|triple|doble|mitad|mitades)$/u;
/** Fractions that are only a quantity after a count ("a third", "un tercio"; not "the third floor"). */
const FRACTION_WORD = /^(?:thirds?|tercios?)$/u;
const FRACTION_COUNT = /^(?:a|one|two|un|una|dos)$/u;
const ARTICLE_WORD = /^(?:a|an|un|una)$/u;
const UNIT_OR_FORM_WORD = new RegExp(`^(?:${DOSE_UNITS}|${DOSE_FORMS})$`, "u");
const SERVICE_NUMBERS = new Set<string>(["911", "988"]);
const COMPOUND_OBJECT_WORD = new RegExp(`^(?:${COMPOUND_OBJECT})$`, "u");
const HOSPITAL_UNIT_WORD = new RegExp(`^(?:${HOSPITAL_UNIT})$`, "u");
/** "al día" after these is "up to date", not a frequency: "mantener al día", "ponerse al día". */
const UP_TO_DATE_VERB =
  /^(?:mantener(?:se|lo|la|los|las)?|mantenga[ns]?|poner(?:se|te|le)?|ponga[ns]?|estar|estes?|esten?)$/u;

/**
 * Medication context for backstop a: generic medication words, dose forms and the dose units
 * that only mean a dose. "unit"/"unidad", "g" and "cc" alone are left out: "the unit's rules",
 * "e.g.". Explicit device tablets are masked before this runs.
 */
const MEDICATION_WORD =
  /^(?:medicines?|medications?|meds?|drugs?|prescriptions?|syrups?|injections?|patch(?:es)?|medicinas?|medicamentos?|remedios?|farmacos?|jarabes?|inyeccion(?:es)?|parches?)$/u;
const CONTEXT_UNIT = new RegExp(
  `^(?:${BARE_DOSE_UNITS}|${DOSE_FORMS}|iu|ui|grams?|gramos?|drops?|gotas?|teaspoons?(?:ful)?|tsp|tablespoons?(?:ful)?|tbsp|cucharaditas?|cucharadas?|puffs?|inhalacion(?:es)?)$`,
  "u",
);

/** Time periods, for "once a day", "dos veces por semana". */
const PERIOD =
  /^(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?|nights?|mornings?|evenings?|minutos?|horas?|dias?|semanas?|mes(?:es)?|noches?|mananas?|tardes?)$/u;
const TIMES_WORD = /^(?:once|twice|thrice|times|vez|veces)$/u;
const PER_WORD = /^(?:a|an|per|al|por|each|every|cada|la|el)$/u;
/** Frequencies on their own: "daily", "diariamente", and clinical abbreviations ("q6h", "bid"). */
const FREQUENCY_WORD =
  /^(?:daily|nightly|hourly|weekly|diario|diaria|diarios|diarias|diariamente|semanal|semanalmente|q\d+h|qd|qod|qhs|qam|qpm|qid|tid|bid|prn)$/u;
/** Clinical abbreviations that are never an EN or ES word ("bid" is), withheld on their own. */
const BARE_FREQUENCY_WORD = /^(?:q\d+h|qd|qod|qhs|qam|qpm|qid|tid)$/u;

/** Times of day tied to a dose, EN + ES. Count after an administration verb or near medication. */
const SCHEDULES = [
  "at bedtime",
  "before bed",
  "before bedtime",
  "at night",
  "in the morning",
  "in the evening",
  "in the afternoon",
  "with meals",
  "with food",
  "before meals",
  "after meals",
  "before eating",
  "after eating",
  "at breakfast",
  "at lunch",
  "at dinner",
  "on an empty stomach",
  // Codex re-review 6 (F7).
  "in the mornings",
  "in the evenings",
  "in the afternoons",
  "at nights",
  "before breakfast",
  "after breakfast",
  "with breakfast",
  "before lunch",
  "after lunch",
  "before dinner",
  "after dinner",
  "with dinner",
  "morning and night",
  "morning and evening",
  "al acostarse",
  "antes de acostarse",
  "antes de dormir",
  "a la hora de dormir",
  "por la manana",
  "por la tarde",
  "por la noche",
  "por las mananas",
  "por las tardes",
  "por las noches",
  "en la manana",
  "en la tarde",
  "en la noche",
  "con las comidas",
  "con la comida",
  "con comida",
  "antes de comer",
  "despues de comer",
  "antes de las comidas",
  "despues de las comidas",
  "en ayunas",
  "al despertar",
  "al despertarse",
  "al levantarse",
  "en las mananas",
  "en las tardes",
  "en las noches",
  "antes del desayuno",
  "despues del desayuno",
  "con el desayuno",
  "antes de la cena",
  "despues de la cena",
  "con la cena",
  "despues del almuerzo",
  "manana y noche",
].map((phrase) => phrase.split(" "));
const SCHEDULE_WORDS = new Set(SCHEDULES.flat());

/**
 * Words a bare fragment may contain besides quantities, frequencies, schedules, units and forms:
 * "half of it", "- twice a day", "500 y media".
 */
const FRAGMENT_FILLER =
  /^(?:a|an|the|of|it|them|and|or|to|x|other|few|un|una|el|la|las|los|de|y|o|lo|otro|otra|pocos|pocas)$/u;

/** How many words apart two signals may be across sentence breaks. */
const DOSE_WINDOW_WORDS = 12;
/** Backstop c: label length with a separator, and without one. */
const LABEL_WORDS_WITH_SEPARATOR = 4;
const LABEL_WORDS_WITHOUT_SEPARATOR = 2;

const CITATION_MARKER = /\[\d+(?:\s*,\s*\d+)*\]/g;
/** Sentence breaks; a dot between digits ("2.5") isn't one. */
const SENTENCE_BREAK = /[!?\n;]+|\.(?!\d)/;
/** A word; a sign counts only when it starts a number ("-5"), not in "twenty-five". */
const WORD = /(?:(?<![\p{L}\p{N}])[-+−](?=\p{N}))?[\p{L}\p{N}½¼¾⅓⅔]+(?:[.,/:]\p{N}+)*/gu;
/**
 * Between a label and its value: a colon, a dash, a bar, a comma, or a hyphen with a space
 * beside it ("Tylenol - 5"; not "555-123" or "twenty-five").
 */
const LABEL_SEPARATOR = /[:—–|,]|\s-|-\s/u;
/** Separators that only ever introduce a value: whatever follows the value doesn't matter. */
const STRONG_SEPARATOR = /(?:[:—–|]|\s-|-\s)/u;
/**
 * A quote after the separator quotes words, not a value ('decir: "Uno de mis hijos…"', a KB
 * line), but only if the quoted text has no number, frequency or schedule (Codex verification:
 * 'Paracetamol: "half the usual amount"'). "one of"/"uno de" is a partitive, not a count.
 */
const QUOTE = /["“”«»'‘’]/u;
const PARTITIVE = /(?<![\p{L}\p{N}])(?:one|uno|una|un)\s+(?:of|de)(?![\p{L}\p{N}])/giu;
function quotesWordsOnly(quoted: string): boolean {
  return numberProvenanceKeys(quoted.replace(PARTITIVE, " ")).size === 0;
}
/** Where a label starts: the start of the sentence, or after one of these. */
const CLAUSE_BOUNDARY = LABEL_SEPARATOR;
/** A condition or comment after a value: "half as needed", "500 si hace falta", "half, then…". */
const CONDITION_WORD =
  /^(?:as|if|when|whenever|for|until|unless|then|while|si|cuando|para|hasta|luego|mientras|salvo)$/u;
/** Backstop e: how many list lines under a heading form one scope, and a heading's length. */
const LIST_SCOPE_LINES = 4;
const LIST_HEADING_WORDS = 4;
/** A list marker at the start of a line: "- ", "• ", "* ", "1. ", "1) ". */
const LIST_MARKER = /^\s*(?:[-•*·]|\d{1,2}[.)])\s+/u;

/**
 * Dotted clinical abbreviations ("b.i.d.", "t. i. d.", "q.6.h."): the dots would split them into
 * sentences, so they're joined before anything else ("bid", "tid", "q6h").
 */
const DOTTED_ABBREVIATION =
  /(?<![\p{L}\p{N}])(?:b\.\s?i\.\s?d|t\.\s?i\.\s?d|q\.\s?i\.\s?d|q\.\s?o\.\s?d|q\.\s?h\.\s?s|q\.\s?a\.\s?m|q\.\s?p\.\s?m|p\.\s?r\.\s?n|q\.\s?d|q\.?\s?\d+\s?\.?\s?h)\.?(?![\p{L}\p{N}])/giu;

/** The ASCII value of any Unicode decimal digit: Nd digits come in runs of ten, 0 to 9. */
function asciiDigit(digit: string): string {
  if (digit >= "0" && digit <= "9") return digit;
  let code = digit.codePointAt(0) ?? 0;
  let offset = 0;
  while (offset < 100 && /\p{Nd}/u.test(String.fromCodePoint(code - 1))) {
    code--;
    offset++;
  }
  return String(offset % 10);
}

/**
 * What the phone, dosage and provenance checks read: NFKC (fullwidth "２", "－", "ｍｇ", "½" →
 * "1⁄2"), every Unicode decimal digit to ASCII ("٢" → "2"), the fraction slash to "/" and the
 * other Unicode hyphens and dashes used as separators to "-".
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\p{Nd}/gu, asciiDigit)
    .replace(/⁄/gu, "/")
    .replace(/[‐‑‒−﹣]/gu, "-");
}

/**
 * What every dosage check reads (Codex re-review 6, F3): `normalizeText`, then dotted
 * abbreviations joined.
 */
export function normalizeForDosage(text: string): string {
  return normalizeText(text).replace(DOTTED_ABBREVIATION, (m) => m.replace(/[.\s]/gu, ""));
}

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

/** A folded word, its sentence, and where it sits in that sentence's text. */
type DoseWord = { word: string; sentence: number; start: number; end: number };

function isQuantityAt(words: readonly DoseWord[], i: number): boolean {
  const w = words[i]?.word ?? "";
  if (SERVICE_NUMBERS.has(w)) return false;
  if (QUANTITY_WORD.test(w) || MULTIPLE_WORD.test(w)) return true;
  if (FRACTION_WORD.test(w)) return FRACTION_COUNT.test(words[i - 1]?.word ?? "");
  if (!ARTICLE_WORD.test(w) || !UNIT_OR_FORM_WORD.test(words[i + 1]?.word ?? "")) return false;
  // Same exclusions as ARTICLE_QUANTITY: "a pill organizer", "una unidad de oncología".
  const [then, more] = [words[i + 2]?.word ?? "", words[i + 3]?.word ?? ""];
  return !COMPOUND_OBJECT_WORD.test(then) && !(then === "de" && HOSPITAL_UNIT_WORD.test(more));
}

/**
 * A frequency at word i. After a verb, "every/each/cada" + anything counts. Before a verb
 * (`strict`), only a period does: "every 8 hours, give…" counts, "different for every child …
 * can give you that list" (a KB line) doesn't.
 */
function isFrequencyAt(words: readonly DoseWord[], i: number, strict: boolean): boolean {
  if (words[i] === undefined) return false;
  return strict
    ? frequencyEnd(words, i) !== -1
    : frequencyEnd(words, i) !== -1 || isEveryAt(words, i);
}

function isEveryAt(words: readonly DoseWord[], i: number): boolean {
  const w = words[i]?.word;
  return (w === "every" || w === "each" || w === "cada") && words[i + 1] !== undefined;
}

/** The last word of a period-based frequency starting at word i ("every 8 hours"), or -1. */
function frequencyEnd(words: readonly DoseWord[], i: number): number {
  const [w, next, after] = [words[i]?.word, words[i + 1]?.word, words[i + 2]?.word];
  if (w === undefined) return -1;
  if (FREQUENCY_WORD.test(w)) return i;
  if (next === undefined) return -1;
  // "3x/day", "2x a week".
  if (/^\d+x$/u.test(w)) {
    if (PERIOD.test(next)) return i + 1;
    return PER_WORD.test(next) && after !== undefined && PERIOD.test(after) ? i + 2 : -1;
  }
  // "a diario".
  if (w === "a" && next === "diario") return i + 1;
  if (w === "every" || w === "each" || w === "cada") {
    if (PERIOD.test(next)) return i + 1;
    const counted = QUANTITY_WORD.test(next) || /^(?:other|few|otro|otra|pocos|pocas)$/u.test(next);
    return counted && after !== undefined && PERIOD.test(after) ? i + 2 : -1;
  }
  // "once a day", "twice per week", "3 times a day", "dos veces al día", "una vez por semana".
  if (TIMES_WORD.test(w) && PER_WORD.test(next)) {
    if (PERIOD.test(next)) return i + 1;
    if (after !== undefined && PERIOD.test(after)) return i + 2;
    return PERIOD.test(words[i + 3]?.word ?? "") ? i + 3 : -1;
  }
  // "a day", "al día", "per day", "por día"; not "mantener al día" (up to date).
  if (w === "al" && UP_TO_DATE_VERB.test(words[i - 1]?.word ?? "")) return -1;
  return (w === "a" || w === "al" || w === "per" || w === "por") &&
    /^(?:day|dia|night|noche)$/u.test(next)
    ? i + 1
    : -1;
}

/** The last word of a schedule starting at word i ("at bedtime", "por la mañana"), or -1. */
function scheduleEnd(words: readonly DoseWord[], i: number): number {
  for (const phrase of SCHEDULES) {
    if (
      phrase.every(
        (p, k) => words[i + k]?.word === p && words[i + k]?.sentence === words[i]?.sentence,
      )
    )
      return i + phrase.length - 1;
  }
  return -1;
}

/** The harmless object of take/give at word i ("take a break"), or -1. */
function harmlessObjectAt(words: readonly DoseWord[], i: number): number {
  if (!TAKE_OR_GIVE.test(words[i]?.word ?? "")) return -1;
  for (let j = i + 1; j <= i + 3 && j < words.length; j++) {
    const w = words[j]?.word ?? "";
    if (HARMLESS_OBJECT.test(w)) return j;
    if (!OBJECT_FILLER.test(w) && !QUANTITY_WORD.test(w)) return -1;
  }
  return -1;
}

/** Device tablets in sentences with no administration verb and no number right before them. */
function maskDeviceTablets(sentence: string): string {
  const words = [...sentence.matchAll(WORD)].map((m) => fold(m[0]));
  if (words.some((w) => ADMIN_VERB.test(w) || USE_VERB.test(w))) return sentence;
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

/**
 * What the backstops see, word by word: where frequencies and schedules start, which words are
 * inside a frequency ("every 2 hours": the 2 isn't a quantity of anything), which belong to a
 * harmless take/give clause ("take a break every 2 hours"), and which sentences are bare
 * fragments (nothing but quantity, frequency or schedule words).
 */
function analyse(words: readonly DoseWord[]) {
  const n = words.length;
  const frequencyStart = new Array<boolean>(n).fill(false);
  const scheduleStart = new Array<boolean>(n).fill(false);
  const inFrequency = new Array<boolean>(n).fill(false);
  const harmless = new Array<boolean>(n).fill(false);
  const bareSentenceParts = new Map<number, [allBare: boolean, anySignal: boolean]>();
  const spanEnd = (i: number) => {
    const end = Math.max(frequencyEnd(words, i), scheduleEnd(words, i));
    return end !== -1 && words[end]?.sentence === words[i]?.sentence ? end : -1;
  };
  for (let i = 0; i < n; i++) {
    const end = frequencyEnd(words, i);
    if (end === -1 || words[end]?.sentence !== words[i]?.sentence) continue;
    // "3 times a day": the count belongs to the frequency.
    const start =
      /^(?:times|veces|vez)$/u.test(words[i]?.word ?? "") && isQuantityAt(words, i - 1) ? i - 1 : i;
    frequencyStart[start] = true;
    for (let k = start; k <= end; k++) inFrequency[k] = true;
  }
  for (let i = 0; i < n; i++) scheduleStart[i] = scheduleEnd(words, i) !== -1;
  for (let i = 0; i < n; i++) {
    const object = harmlessObjectAt(words, i);
    if (object === -1) continue;
    const end = spanEnd(object + 1);
    for (let k = i; k <= Math.max(object, end); k++) harmless[k] = true;
  }
  const quantity = words.map((w, i) => {
    if (harmless[i] || inFrequency[i] || !isQuantityAt(words, i)) return false;
    // EN "once" starts clauses ("Once you arrive, …"): a count only at the end of one.
    if (w.word !== "once") return true;
    const next = words[i + 1];
    return next === undefined || next.sentence !== w.sentence || isBareWord(next.word);
  });
  const signal = words.map(
    (_, i) => quantity[i] || (!harmless[i] && (frequencyStart[i] || scheduleStart[i])),
  );
  // A sentence is bare if every word is a bare word and one of them is a signal.
  const bareSentence = new Map<number, boolean>();
  for (const [i, { word, sentence }] of words.entries()) {
    const [allBare, anySignal] = bareSentenceParts.get(sentence) ?? [true, false];
    bareSentenceParts.set(sentence, [allBare && isBareWord(word), anySignal || signal[i] === true]);
  }
  for (const [sentence, [allBare, anySignal]] of bareSentenceParts)
    bareSentence.set(sentence, allBare && anySignal);
  return {
    frequencyStart: (i: number) => !harmless[i] && frequencyStart[i] === true,
    quantity: (i: number) => quantity[i] === true,
    signal: (i: number) => signal[i] === true,
    bare: (i: number) => bareSentence.get(words[i]?.sentence ?? -1) === true,
  };
}

function isBareWord(w: string): boolean {
  return (
    QUANTITY_WORD.test(w) ||
    MULTIPLE_WORD.test(w) ||
    FRACTION_WORD.test(w) ||
    TIMES_WORD.test(w) ||
    PER_WORD.test(w) ||
    PERIOD.test(w) ||
    FREQUENCY_WORD.test(w) ||
    UNIT_OR_FORM_WORD.test(w) ||
    SCHEDULE_WORDS.has(w) ||
    FRAGMENT_FILLER.test(w)
  );
}

/** The words of one line, split into sentences, for the list-scope check. */
function lineWords(line: string): DoseWord[] {
  return line
    .split(SENTENCE_BREAK)
    .map(maskDeviceTablets)
    .flatMap((s, sentence) =>
      [...s.matchAll(WORD)].map((m) => ({
        word: fold(m[0]),
        sentence,
        start: m.index,
        end: m.index + m[0].length,
      })),
    );
}

/** Every dosage match, most specific rule first. */
function dosageMatches(text: string): string[] {
  const clean = normalizeForDosage(text).replace(CITATION_MARKER, " ");
  const sentences = clean.split(SENTENCE_BREAK).map(maskDeviceTablets);
  const matches = sentences.flatMap((s) => [...s.matchAll(DOSAGE)].map((m) => m[0]));
  const words: DoseWord[] = sentences.flatMap((s, sentence) =>
    [...s.matchAll(WORD)].map((m) => ({
      word: fold(m[0]),
      sentence,
      start: m.index,
      end: m.index + m[0].length,
    })),
  );
  const sameSentence = (i: number, j: number) => words[i]?.sentence === words[j]?.sentence;
  const at = analyse(words);
  /** The first j after i (same sentence or within the window) where `hit(j)`, or -1. */
  const after = (i: number, hit: (j: number) => boolean, from = i + 1) => {
    for (let j = from; j < words.length; j++) {
      if (j - i > DOSE_WINDOW_WORDS && !sameSentence(i, j)) break;
      if (hit(j)) return j;
    }
    return -1;
  };
  /** The first j before i (same sentence, or a bare fragment within the window) where `hit(j)`. */
  const before = (i: number, hit: (j: number) => boolean) => {
    for (let j = i - 1; j >= 0; j--) {
      const near = i - j <= DOSE_WINDOW_WORDS;
      if (!near && !sameSentence(i, j)) break;
      if ((sameSentence(i, j) || at.bare(j)) && hit(j)) return j;
    }
    return -1;
  };
  const found = (i: number, j: number) => {
    if (j !== -1) matches.push(`${words[Math.min(i, j)]?.word} … ${words[Math.max(i, j)]?.word}`);
    return j !== -1;
  };

  for (const [i, { word }] of words.entries()) {
    // Rule 3, standalone: clinical frequency abbreviations.
    if (BARE_FREQUENCY_WORD.test(word)) matches.push(word);

    // Rules 1–2 and d: administration verbs.
    const use = USE_VERB.test(word);
    if ((ADMIN_VERB.test(word) || use) && harmlessObjectAt(words, i) === -1) {
      let hit: (j: number) => boolean = (j) =>
        isQuantityAt(words, j) || isFrequencyAt(words, j, false) || scheduleEnd(words, j) !== -1;
      if (use) {
        // A frequency or schedule right after use/usa belongs to a relative clause ("anything
        // you use every day"): skip past it. Anything later counts, also after a neuter
        // relative object ("Use whatever was prescribed every morning").
        const end = Math.max(frequencyEnd(words, i + 1), scheduleEnd(words, i + 1));
        const from = end !== -1 && sameSentence(i, end) ? end + 1 : i + 1;
        hit = (j) =>
          isQuantityAt(words, j) ||
          (j >= from && (scheduleEnd(words, j) !== -1 || isFrequencyAt(words, j, true)));
      }
      if (!found(i, after(i, hit))) {
        // Before the verb, in the same sentence: "Every 8 hours, give it", "At bedtime, use it".
        for (let j = i - 1; j >= 0 && sameSentence(i, j); j--) {
          if (isFrequencyAt(words, j, true) || scheduleEnd(words, j) !== -1) {
            found(i, j);
            break;
          }
        }
      }
    }

    // a: medication context + quantity, frequency or schedule.
    if (MEDICATION_WORD.test(word) || CONTEXT_UNIT.test(word)) {
      found(i, after(i, at.signal)) || found(i, before(i, at.signal));
    }

    // b: a quantity + a frequency.
    if (at.quantity(i)) {
      found(i, after(i, at.frequencyStart)) || found(i, before(i, at.frequencyStart));
    }
  }

  // c: label / list fragments, per sentence.
  const bySentence = sentences.map(() => [] as (DoseWord & { i: number })[]);
  for (const [i, w] of words.entries()) bySentence[w.sentence]?.push({ ...w, i });
  for (const [s, sentence] of sentences.entries()) {
    const ws = bySentence[s] ?? [];
    const gap = (m: number) => sentence.slice(ws[m - 1]?.end ?? 0, ws[m]?.start ?? 0);
    for (let m = 1; m < ws.length; m++) {
      const first = ws[m]?.i ?? -1;
      // The label: back to the start of the sentence or the previous separator.
      let labelStart = m - 1;
      while (labelStart > 0 && !CLAUSE_BOUNDARY.test(gap(labelStart))) labelStart--;
      const label = ws.slice(labelStart, m).map((w) => w.i);
      if (label.some((i) => harmlessObjectAt(words, i) !== -1)) continue;
      const separated = LABEL_SEPARATOR.test(gap(m));
      if (label.length > (separated ? LABEL_WORDS_WITH_SEPARATOR : LABEL_WORDS_WITHOUT_SEPARATOR))
        continue;
      // A strong separator and a value that starts with a signal: whatever follows.
      const quoted =
        QUOTE.test(gap(m)) &&
        quotesWordsOnly(sentence.slice(ws[m]?.start ?? 0).split(QUOTE)[0] ?? "");
      if (STRONG_SEPARATOR.test(gap(m)) && !quoted && at.signal(first)) {
        matches.push(`${ws[labelStart]?.word} … ${ws[m]?.word}`);
        continue;
      }
      // Otherwise the value is a run of bare words that ends the clause or meets a condition.
      if (!isBareWord(ws[m]?.word ?? "") || (!separated && isBareWord(ws[m - 1]?.word ?? "")))
        continue;
      let end = m + 1;
      while (end < ws.length && isBareWord(ws[end]?.word ?? "") && !CLAUSE_BOUNDARY.test(gap(end)))
        end++;
      const closed =
        end === ws.length ||
        CONDITION_WORD.test(ws[end]?.word ?? "") ||
        (separated && CLAUSE_BOUNDARY.test(gap(end)));
      const run = ws.slice(m, end).map((w) => w.i);
      const timed = run.some((i) => at.frequencyStart(i) || (at.signal(i) && !at.quantity(i)));
      if (closed && run.some(at.signal) && (separated || timed)) {
        matches.push(`${ws[labelStart]?.word} … ${ws[end - 1]?.word}`);
      }
    }
  }

  // e: list scope. A short heading and the list lines under it: an item that starts with a
  // quantity, frequency or schedule is a dose ("Paracetamol\n- half\n- at bedtime").
  const lines = clean.split("\n");
  for (const [h, heading] of lines.entries()) {
    const headingWords = [...heading.matchAll(WORD)].map((m) => fold(m[0]));
    if (headingWords.length === 0 || LIST_MARKER.test(heading)) continue;
    if (headingWords.length > LIST_HEADING_WORDS && !heading.trimEnd().endsWith(":")) continue;
    for (const line of lines.slice(h + 1, h + 1 + LIST_SCOPE_LINES)) {
      const marked = LIST_MARKER.test(line);
      const item = lineWords(line.replace(LIST_MARKER, ""));
      const at1 = analyse(item);
      if (item.length === 0) break;
      const startsWithSignal = at1.signal(0);
      // An unmarked line counts only if it's nothing but quantity, frequency or schedule words,
      // or such words and then a condition ("Half as needed").
      const firstOther = item.findIndex((w) => !isBareWord(w.word));
      const bareItem = firstOther === -1 || CONDITION_WORD.test(item[firstOther]?.word ?? "");
      if (!marked && !bareItem) break;
      if (startsWithSignal) {
        matches.push(`${headingWords[0]} … ${item[0]?.word}`);
        break;
      }
    }
  }
  return matches;
}

/*
 * Number provenance (ADR 0015, layer 4, Codex verification): every NUMBER and every FREQUENCY or
 * SCHEDULE in a generated answer must also appear in an article it cites. The KB has no doses,
 * so a dose number can never pass, whatever the formatting around it. The comparison is on sets
 * of normalized tokens, so lists, quotes, line breaks and punctuation don't matter. Benign
 * numbers the cited guide doesn't contain are withheld too: the accepted false positive, tracked
 * in EVALS.md. Citation markers and the service numbers 911 and 988 don't count.
 */

/** Roman numerals II–XII as standalone uppercase tokens. Bare "I" is the EN pronoun, not 1. */
const ROMAN_NUMERALS = new Map(
  ["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"].map((r, i) => [
    r,
    String(i + 2),
  ]),
);
/**
 * Written numbers, fractions and multiples, EN + ES, folded. "once" is 11 in both languages: in
 * EN that's a false positive ("once you arrive" needs "once" in the cited guide), accepted.
 */
const NUMBER_WORDS = new Map<string, string>(
  Object.entries({
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    eleven: "11",
    twelve: "12",
    dozen: "12",
    thirteen: "13",
    fourteen: "14",
    fifteen: "15",
    sixteen: "16",
    seventeen: "17",
    eighteen: "18",
    nineteen: "19",
    twenty: "20",
    thirty: "30",
    forty: "40",
    fifty: "50",
    sixty: "60",
    seventy: "70",
    eighty: "80",
    ninety: "90",
    hundred: "100",
    thousand: "1000",
    cero: "0",
    un: "1",
    uno: "1",
    una: "1",
    dos: "2",
    tres: "3",
    cuatro: "4",
    cinco: "5",
    seis: "6",
    siete: "7",
    ocho: "8",
    nueve: "9",
    diez: "10",
    once: "11",
    doce: "12",
    docena: "12",
    trece: "13",
    catorce: "14",
    quince: "15",
    dieciseis: "16",
    diecisiete: "17",
    dieciocho: "18",
    diecinueve: "19",
    veinte: "20",
    treinta: "30",
    cuarenta: "40",
    cincuenta: "50",
    sesenta: "60",
    setenta: "70",
    ochenta: "80",
    noventa: "90",
    cien: "100",
    ciento: "100",
    mil: "1000",
    half: "1/2",
    halves: "1/2",
    media: "1/2",
    medio: "1/2",
    mitad: "1/2",
    third: "1/3",
    thirds: "1/3",
    tercio: "1/3",
    tercios: "1/3",
    quarter: "1/4",
    quarters: "1/4",
    cuarto: "1/4",
    cuartos: "1/4",
    double: "2x",
    doble: "2x",
    twice: "2x",
    triple: "3x",
    thrice: "3x",
  }),
);
const DIGIT_NUMBER = /\d+(?:[.,:/]\d+)*/g;

/** "1,000" and "1.000" → "1000", "1,5" → "1.5", "08:00" → "8:00". */
function canonicalNumber(digits: string): string {
  return digits
    .replace(/[.,](?=\d{3}(?!\d))/g, "")
    .replace(",", ".")
    .replace(/^0+(?=\d)/, "");
}

/** The number values in one word: digits, a Roman numeral, or a written number. */
function wordNumbers(raw: string): string[] {
  const roman = ROMAN_NUMERALS.get(raw);
  if (roman) return [roman];
  const written = NUMBER_WORDS.get(fold(raw));
  if (written) return [written];
  return (raw.match(DIGIT_NUMBER) ?? []).map(canonicalNumber);
}

/**
 * The normalized number tokens and frequency/schedule phrase keys of a text. Words are read
 * across sentence and line breaks ("at\nbedtime" is "at bedtime"), and numbers inside a phrase
 * are normalized ("every two hours" and "every 2 hours" are one key).
 */
export function numberProvenanceKeys(text: string): Set<string> {
  const clean = normalizeText(text).replace(CITATION_MARKER, " ");
  const raws = [...clean.matchAll(WORD)].map((m) => m[0]);
  const words: DoseWord[] = raws.map((raw) => ({ word: fold(raw), sentence: 0, start: 0, end: 0 }));
  const keys = new Set<string>();
  for (const raw of raws) {
    for (const n of wordNumbers(raw)) if (!SERVICE_NUMBERS.has(n)) keys.add(n);
  }
  const phraseKey = (from: number, to: number) =>
    words
      .slice(from, to + 1)
      .map((w, k) => wordNumbers(raws[from + k] ?? "")[0] ?? w.word)
      .join(" ");
  for (let i = 0; i < words.length; i++) {
    for (const end of [frequencyEnd(words, i), scheduleEnd(words, i)]) {
      if (end !== -1) keys.add(phraseKey(i, end));
    }
  }
  return keys;
}

/** The answer's number and frequency/schedule keys that none of the cited articles contains. */
export function findUnsourcedNumbers(answer: string, sources: readonly string[]): string[] {
  const allowed = new Set(sources.flatMap((source) => [...numberProvenanceKeys(source)]));
  return [...numberProvenanceKeys(answer)].filter((key) => !allowed.has(key));
}

/** Medical-claim and tone words the guidelines ban, EN + ES. Whole words, case-insensitive. */
const BANNED_WORDS =
  /\b(?:cure[sd]?|curing|guarantee[sd]?|cura|curar|curación|garantiza(?:r|do|da|mos)?|garantía|journey|warriors?|guerrer[oa]s?|everything happens for a reason|todo pasa por algo)\b/giu;

export type ContentViolation = { rule: "phone_number" | "dosage" | "banned_word"; match: string };

export function findContentViolations(text: string): ContentViolation[] {
  const violations: ContentViolation[] = [];
  // On normalized text: "５５５－１２３－４５６７" and "٥٥٥-١٢٣-٤٥٦٧" are read as "555-123-4567".
  const normalized = normalizeText(text);
  for (const m of normalized.matchAll(PHONE_LIKE)) {
    violations.push({ rule: "phone_number", match: m[0].trim() });
  }
  for (const m of normalized.matchAll(N11)) violations.push({ rule: "phone_number", match: m[0] });
  for (const match of dosageMatches(text)) violations.push({ rule: "dosage", match });
  for (const m of text.matchAll(BANNED_WORDS))
    violations.push({ rule: "banned_word", match: m[0] });
  return violations;
}
