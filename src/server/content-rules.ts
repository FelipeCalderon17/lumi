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
 *   c. LABEL / LIST fragments: a clause of up to 4 words, a separator (: — – , or a spaced
 *      hyphen) and a tail that is nothing but quantity, frequency or schedule words
 *      ("acetaminophen: half", "Morphine — 5 — twice daily"); or, with no separator, up to 2
 *      words and such a tail with a frequency or schedule in it ("Paracetamol every 6 hours").
 *   d. use/usa count like the other verbs once something sits between the verb and the
 *      frequency or schedule ("Use insulin daily", "Usa insulina diariamente"); right after
 *      it, the frequency belongs to a relative clause ("anything you use every day", "lo que
 *      uses a diario": KB lines).
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
  "mg|mgs|mcg|µg|ug|ml|mls|cc|iu|ui|g|gr|grams?|gramos?|milligrams?|micrograms?|millilit(?:er|re)s?|miligramos?|microgramos?|mililitros?|international units?|unidad(?:es)? internacionales|units?|unidad(?:es)?|drops?|gotas?|teaspoons?(?:ful)?|tsp|tablespoons?(?:ful)?|tbsp|cucharaditas?|cucharadas?|puffs?|inhalaci(?:o|ó)n(?:es)?";
/** Dose forms. A tablet is only the device in an explicit construction (see DEVICE_TABLET). */
export const DOSE_FORMS =
  "tablets?|pills?|capsules?|doses?|tabletas?|pastillas?|comprimidos?|c[aá]psulas?|dosis";
/** Units that only ever mean a dose, so they're withheld even without a number. */
const BARE_DOSE_UNITS =
  "mg|mgs|mcg|µg|ml|mls|milligrams?|micrograms?|millilit(?:er|re)s?|miligramos?|microgramos?|mililitros?";

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
const ARTICLE_WORD = /^(?:a|an|un|una)$/u;
const UNIT_OR_FORM_WORD = new RegExp(`^(?:${DOSE_UNITS}|${DOSE_FORMS})$`, "u");
const SERVICE_NUMBERS = new Set<string>(["911", "988"]);
const COMPOUND_OBJECT_WORD = new RegExp(`^(?:${COMPOUND_OBJECT})$`, "u");
const HOSPITAL_UNIT_WORD = new RegExp(`^(?:${HOSPITAL_UNIT})$`, "u");
/**
 * Neuter relatives as the object of use/usa ("use whatever…", "usa lo que…"): a frequency after
 * them is the inner verb's. Not "la que"/"the one that", which can stand for a medicine.
 */
const NEUTER_RELATIVE = /^(?:what|whatever|anything|everything|lo que|todo lo|cualquier cosa)$/u;

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
/** Between a label and its value: a colon, a dash, a comma, or a hyphen with a space beside it. */
const LABEL_SEPARATOR = /[:—–,]|(?:^|\s)-|-(?:\s|$)/u;
/** Where a label starts: the start of the sentence, or after one of these. */
const CLAUSE_BOUNDARY = /[:—–,]|(?:^|\s)-|-(?:\s|$)/u;

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
  if (QUANTITY_WORD.test(w)) return true;
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
  // "a day", "al día", "per day", "por día".
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
  const quantity = (i: number) => {
    if (inFrequency[i] || !isQuantityAt(words, i)) return false;
    // EN "once" starts clauses ("Once you arrive, …"): a count only at the end of one.
    if (words[i]?.word !== "once") return true;
    const next = words[i + 1];
    return next === undefined || next.sentence !== words[i]?.sentence || isBareWord(next.word);
  };
  const signal = (i: number) =>
    !harmless[i] && (quantity(i) || frequencyStart[i] === true || scheduleStart[i] === true);
  const bareSentence = new Map<number, boolean>();
  for (const [i, { word, sentence }] of words.entries()) {
    const bare = (bareSentence.get(sentence) ?? true) && isBareWord(word);
    bareSentence.set(sentence, bare);
    if (i === n - 1 || words[i + 1]?.sentence !== sentence) {
      const first = words.findIndex((w) => w.sentence === sentence);
      let hasSignal = false;
      for (let k = first; k <= i; k++) hasSignal ||= signal(k);
      bareSentence.set(sentence, bare && hasSignal);
    }
  }
  return {
    frequencyStart: (i: number) => !harmless[i] && frequencyStart[i] === true,
    quantity: (i: number) => !harmless[i] && quantity(i),
    signal,
    bare: (i: number) => bareSentence.get(words[i]?.sentence ?? -1) === true,
  };
}

function isBareWord(w: string): boolean {
  return (
    QUANTITY_WORD.test(w) ||
    TIMES_WORD.test(w) ||
    PER_WORD.test(w) ||
    PERIOD.test(w) ||
    FREQUENCY_WORD.test(w) ||
    UNIT_OR_FORM_WORD.test(w) ||
    SCHEDULE_WORDS.has(w) ||
    FRAGMENT_FILLER.test(w)
  );
}

/** Every dosage match, most specific rule first. */
function dosageMatches(text: string): string[] {
  const sentences = text.replace(CITATION_MARKER, " ").split(SENTENCE_BREAK).map(maskDeviceTablets);
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
      if (use) {
        // A frequency or schedule right after use/usa belongs to a relative clause ("anything
        // you use every day"): skip past it. When the object is itself a relative clause ("usa
        // lo que vayas a mantener al día"), any frequency in it is the inner verb's.
        const end = Math.max(frequencyEnd(words, i + 1), scheduleEnd(words, i + 1));
        const [w1, w2] = [words[i + 1]?.word ?? "", words[i + 2]?.word ?? ""];
        const relative = NEUTER_RELATIVE.test(w1) || NEUTER_RELATIVE.test(`${w1} ${w2}`);
        const from = relative
          ? Number.POSITIVE_INFINITY
          : end !== -1 && sameSentence(i, end)
            ? end + 1
            : i + 1;
        found(
          i,
          after(
            i,
            (j) =>
              isQuantityAt(words, j) ||
              (j >= from && (isFrequencyAt(words, j, true) || scheduleEnd(words, j) !== -1)),
          ),
        );
      } else if (
        !found(
          i,
          after(
            i,
            (j) =>
              isQuantityAt(words, j) ||
              isFrequencyAt(words, j, false) ||
              scheduleEnd(words, j) !== -1,
          ),
        )
      ) {
        // Before the verb, in the same sentence: "Every 8 hours, give it", "At bedtime, give it".
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
  for (const [s, sentence] of sentences.entries()) {
    const ws = words.map((w, i) => ({ ...w, i })).filter((w) => w.sentence === s);
    // The bare tail: the longest run of bare words that ends the sentence.
    let k = ws.length;
    while (k > 0 && isBareWord(ws[k - 1]?.word ?? "")) k--;
    if (k === 0 || k === ws.length) continue;
    const tail = ws.slice(k).map((w) => w.i);
    if (!tail.some(at.signal)) continue;
    const gap = (m: number) => sentence.slice(ws[m - 1]?.end ?? 0, ws[m]?.start ?? 0);
    let labelStart = k - 1;
    while (labelStart > 0 && !CLAUSE_BOUNDARY.test(gap(labelStart))) labelStart--;
    const label = ws.slice(labelStart, k).map((w) => w.i);
    if (label.some((i) => harmlessObjectAt(words, i) !== -1)) continue;
    const separated = LABEL_SEPARATOR.test(gap(k));
    const timed = tail.some((i) => at.frequencyStart(i) || (at.signal(i) && !at.quantity(i)));
    if (
      (separated && label.length <= LABEL_WORDS_WITH_SEPARATOR) ||
      (!separated && label.length <= LABEL_WORDS_WITHOUT_SEPARATOR && timed)
    ) {
      matches.push(`${ws[labelStart]?.word} … ${ws.at(-1)?.word}`);
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
