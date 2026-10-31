/**
 * Quantities in notebook text, for the "no invented numbers" check (Codex re-reviews 3–4).
 *
 * FAIL CLOSED, EXACT SPAN. Every numeric thing in a text becomes a key: its sign, its value and
 * the whole unit after it, kept together. An item's keys must all appear in the notes it cites:
 *   - "value|unit": a leading sign ("-5", "+2"), the value from digits ("2.5", "2,5"),
 *     fractions ("1/2", "1 / 2", "½"), clock times ("8:30") or written numbers EN/ES ("fifty",
 *     "treinta y cinco", "half", "media"), and the full canonical unit after it. Units stay
 *     distinct ("°C" ≠ "°F" ≠ "degrees", "mL" ≠ "mg"), compound units stay whole ("mL/kg", "mg
 *     per kg" → "ml/kg", "mg/kg"), and letters glued to a number keep their spelling ("5mEq" →
 *     "5|meq") even if we don't know the unit. A plain word after the number ("3 kids") is no
 *     unit: "3|".
 *   - an article before a dose unit or form is a quantity of one: "a tablet", "un miligramo",
 *     "una unidad" → "1|tablet", "1|mg", "1|unit".
 *   - "raw|…|unit" for anything we can't read confidently: "1,000" (thousands or decimal?),
 *     "1.2.3", "5/0", "²". The characters (with the sign) must match verbatim, AND the unit is
 *     bound to them, so "1,000 mg" → "1,000 ml" fails.
 *   - "code|…" for letters followed by digits ("B12", "x2"): same, verbatim only.
 * The only equivalences are trivially safe ones: the same value in another spelling ("½" =
 * "1/2" = "1 / 2" = "half", "2,5" = "2.5", "three" = "3", "a tablet" = "one tablet") with the
 * same canonical unit. So "38 °C" → "38 °F", "5 ml" → "-5 ml", "1/2 tablet" → "2 tablets" and "a
 * tablet" from a note without one all fail, and the page falls back to the raw notes.
 */

const CANONICAL_UNITS: Record<string, readonly string[]> = {
  ml: [
    "ml",
    "mls",
    "milliliter",
    "milliliters",
    "millilitre",
    "millilitres",
    "mililitro",
    "mililitros",
  ],
  cc: ["cc"],
  l: ["l", "liter", "liters", "litre", "litres", "litro", "litros"],
  dl: ["dl"],
  mg: ["mg", "mgs", "milligram", "milligrams", "miligramo", "miligramos"],
  mcg: ["mcg", "µg", "ug", "microgram", "micrograms", "microgramo", "microgramos"],
  g: ["g", "gr", "gram", "grams", "gramo", "gramos"],
  kg: ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms", "kilogramo", "kilogramos"],
  lb: ["lb", "lbs", "pound", "pounds", "libra", "libras"],
  oz: ["oz", "ounce", "ounces", "onza", "onzas"],
  mmol: ["mmol"],
  meq: ["meq"],
  iu: ["iu", "ui"],
  cm: ["cm", "centimeter", "centimeters", "centimetro", "centimetros"],
  mm: ["mm", "millimeter", "millimeters", "milimetro", "milimetros"],
  inch: ["inch", "inches", "pulgada", "pulgadas"],
  mmhg: ["mmhg"],
  bpm: ["bpm"],
  kcal: ["kcal", "calorie", "calories", "caloria", "calorias"],
  deg_c: ["°c", "ºc", "c", "celsius", "centigrade", "centigrados"],
  deg_f: ["°f", "ºf", "f", "fahrenheit"],
  deg: ["°", "º", "degree", "degrees", "grado", "grados"],
  pct: ["%", "percent", "porciento"],
  am: ["am"],
  pm: ["pm"],
  s: ["sec", "secs", "second", "seconds", "segundo", "segundos"],
  min: ["min", "mins", "minute", "minutes", "minuto", "minutos"],
  h: ["h", "hr", "hrs", "hour", "hours", "hora", "horas"],
  day: ["day", "days", "dia", "dias"],
  night: ["night", "nights", "noche", "noches"],
  week: ["week", "weeks", "semana", "semanas"],
  month: ["month", "months", "mes", "meses"],
  year: ["year", "years", "ano", "anos"],
  times: ["time", "times", "vez", "veces"],
  tablet: ["tablet", "tablets", "pill", "pills", "tableta", "tabletas", "pastilla", "pastillas"],
  capsule: ["capsule", "capsules", "capsula", "capsulas"],
  drop: ["drop", "drops", "gota", "gotas"],
  tsp: ["tsp", "teaspoon", "teaspoons", "cucharadita", "cucharaditas"],
  tbsp: ["tbsp", "tablespoon", "tablespoons", "cucharada", "cucharadas"],
  puff: ["puff", "puffs", "inhalacion", "inhalaciones"],
  unit: ["unit", "units", "unidad", "unidades"],
  dose: ["dose", "doses", "dosis"],
};
const UNIT_ALIASES = new Map<string, string>();
for (const [unit, aliases] of Object.entries(CANONICAL_UNITS)) {
  for (const alias of aliases) UNIT_ALIASES.set(alias, unit);
}
/** "38 grados centígrados" → °C: a scale word right after a degree word. */
const DEGREE_SCALE: Record<string, string> = {
  c: "deg_c",
  celsius: "deg_c",
  centigrade: "deg_c",
  centigrados: "deg_c",
  f: "deg_f",
  fahrenheit: "deg_f",
};

/** Written whole numbers, EN + ES. Not EN "once"/ES "once" (11): the same word, two values. */
const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  cero: 0,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiun: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
};
const MULTIPLIERS: Record<string, number> = { hundred: 100, thousand: 1000, mil: 1000 };
/** Words that are a value on their own. */
const FRACTION_WORDS: Record<string, string> = {
  half: "1/2",
  medio: "1/2",
  media: "1/2",
  quarter: "1/4",
};
/** Words that are a count of times: "twice" = "2 times" = "dos veces". */
const TIMES_WORDS: Record<string, string> = { twice: "2", thrice: "3" };
/** Fraction characters are the same text as the written fraction: "½" = "1/2". */
const FRACTION_CHARS: Record<string, string> = {
  "½": "1/2",
  "¼": "1/4",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
};

type Token = {
  kind: "time" | "num" | "word" | "sym" | "other";
  text: string;
  start: number;
  end: number;
};

const TOKEN =
  /(\d{1,2}:\d{2})|(\d+(?:[.,]\d+)*(?:\s?\/\s?\d+(?:[.,]\d+)*)?[½¼¾⅓⅔]?|[½¼¾⅓⅔])|([\p{L}µ]+)|([°º%/+\-−])|(\S)/gu;

/** Units an article can count as one of: "a tablet", "un miligramo", "una unidad". */
const ARTICLE_UNITS = new Set([
  "ml",
  "cc",
  "mg",
  "mcg",
  "g",
  "iu",
  "meq",
  "mmol",
  "tablet",
  "capsule",
  "drop",
  "tsp",
  "tbsp",
  "puff",
  "unit",
  "dose",
]);
const ARTICLES = new Set(["a", "an", "un", "una"]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/(?<![\p{L}])([ap])\.\s?m\.?/gu, "$1m");
}

function tokenize(text: string): Token[] {
  return [...normalize(text).matchAll(TOKEN)].map((m) => {
    const kind = m[1] ? "time" : m[2] ? "num" : m[3] ? "word" : m[4] ? "sym" : "other";
    const start = m.index ?? 0;
    return { kind, text: m[0], start, end: start + m[0].length };
  });
}

/** "007" → "7". Text, not Number: long digit runs don't round into each other. */
const integerText = (digits: string) => digits.replace(/^0+(?=\d)/, "");

/**
 * The canonical text of a digit token, or null when it can't be read confidently. Only
 * trivially safe equivalences: "2,5" = "2.5" = "2.50", "½" = "1/2" = "1 / 2", "1½" = "1+1/2".
 * Fractions are NOT reduced: "2/4" ≠ "1/2", and "120/80" ≠ "150/100" (blood pressure).
 */
function digitText(text: string): string | null {
  const fraction = FRACTION_CHARS[text.slice(-1)];
  const body = fraction === undefined ? text : text.slice(0, -1);
  if (body === "") return fraction ?? null;
  if (body.includes("/")) {
    const [a = "", b = ""] = body.split("/").map((part) => part.trim());
    if (fraction !== undefined || !/^\d+$/.test(a) || !/^\d+$/.test(b) || /^0+$/.test(b)) {
      return null;
    }
    return `${integerText(a)}/${integerText(b)}`;
  }
  if (/^\d+$/.test(body)) {
    return fraction === undefined ? integerText(body) : `${integerText(body)}+${fraction}`;
  }
  // "2.5", "2,5": one separator. Exactly three digits after it ("1,000") could be thousands.
  const decimal = /^(\d+)[.,](\d+)$/.exec(body);
  if (decimal && fraction === undefined && decimal[2]?.length !== 3) {
    const decimals = (decimal[2] ?? "").replace(/0+$/, "");
    const whole = integerText(decimal[1] ?? "");
    return decimals === "" ? whole : `${whole}.${decimals}`;
  }
  return null;
}

const adjacent = (a: Token | undefined, b: Token | undefined) =>
  a !== undefined && b !== undefined && a.end === b.start;

/** The unit starting at token i, and the index after it. */
function readUnit(tokens: Token[], i: number, afterValue: Token): { unit: string; next: number } {
  const t = tokens[i];
  if (t === undefined) return { unit: "", next: i };
  if (t.kind === "sym" && (t.text === "°" || t.text === "º")) {
    const scale = tokens[i + 1];
    if (scale?.kind === "word" && DEGREE_SCALE[scale.text]) {
      return { unit: DEGREE_SCALE[scale.text] ?? "deg", next: i + 2 };
    }
    return { unit: "deg", next: i + 1 };
  }
  if (t.kind === "sym" && t.text === "%") return { unit: "pct", next: i + 1 };
  if (t.kind !== "word") return { unit: "", next: i };
  const known = UNIT_ALIASES.get(t.text);
  // Unknown letters glued to the number are kept as written: "5mEq", "2x".
  const first = known ?? (adjacent(afterValue, t) ? t.text : undefined);
  if (first === undefined) return { unit: "", next: i };
  let unit = first;
  let next = i + 1;
  if (unit === "deg") {
    const scale = tokens[next];
    if (scale?.kind === "word" && DEGREE_SCALE[scale.text]) {
      unit = DEGREE_SCALE[scale.text] ?? unit;
      next += 1;
    }
  }
  // Compound units stay whole: "ml/kg", "mg per kg", "mg por día".
  for (;;) {
    const join = tokens[next];
    const part = tokens[next + 1];
    const joined =
      (join?.kind === "sym" && join.text === "/") ||
      (join?.kind === "word" && (join.text === "per" || join.text === "por"));
    if (!joined || part?.kind !== "word") break;
    const partUnit = UNIT_ALIASES.get(part.text);
    // "/" always joins; "per"/"por" only before a unit ("por la noche" isn't one).
    if (partUnit === undefined && join?.text !== "/") break;
    unit = `${unit}/${partUnit ?? part.text}`;
    next += 2;
  }
  return { unit, next };
}

/** A written number starting at token i: "twenty-five", "one hundred and five", "treinta y cinco". */
function readWrittenNumber(tokens: Token[], i: number): { value: number; next: number } | null {
  let total = 0;
  let current = 0;
  let next = i;
  let any = false;
  for (;;) {
    const t = tokens[next];
    if (t?.kind !== "word") break;
    const small = NUMBER_WORDS[t.text];
    const multiplier = MULTIPLIERS[t.text];
    if (small !== undefined) {
      current += small;
    } else if (multiplier === 100) {
      current = (current || 1) * 100;
    } else if (multiplier !== undefined) {
      total += (current || 1) * multiplier;
      current = 0;
    } else {
      break;
    }
    any = true;
    next += 1;
    // Connectors between number words: "twenty-five", "hundred and five", "treinta y cinco".
    const join = tokens[next];
    const after = tokens[next + 1];
    const joins =
      (join?.kind === "sym" && join.text === "-") ||
      (join?.kind === "word" && (join.text === "and" || join.text === "y"));
    if (
      joins &&
      after?.kind === "word" &&
      (after.text in NUMBER_WORDS || after.text in MULTIPLIERS)
    ) {
      next += 1;
    }
  }
  return any ? { value: total + current, next } : null;
}

/**
 * The sign right before the number at token i ("-5", "+2", "−5"), or "". Not a hyphen joined
 * to what's before it: "5-10" is a range, "B-12" a name.
 */
function signOf(tokens: Token[], i: number): string {
  const sign = tokens[i - 1];
  if (sign?.kind !== "sym" || !["-", "+", "−"].includes(sign.text)) return "";
  if (!adjacent(sign, tokens[i])) return "";
  const before = tokens[i - 2];
  if (adjacent(before, sign) && before?.kind !== "sym") return "";
  return sign.text === "+" ? "+" : "-";
}

/** "and a half" / "y medio/media" after a number: "+1/2". */
function readHalf(tokens: Token[], i: number): { add: string; next: number } {
  const [a, b, c] = [tokens[i]?.text, tokens[i + 1]?.text, tokens[i + 2]?.text];
  if (a === "and" && b === "a" && c === "half") return { add: "+1/2", next: i + 3 };
  if (a === "y" && (b === "medio" || b === "media")) return { add: "+1/2", next: i + 2 };
  return { add: "", next: i };
}

/** Every quantity in `text`, as keys (see the module comment). */
export function quantitiesIn(text: string): string[] {
  const tokens = tokenize(text);
  const keys: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i] as Token;
    if (t.kind === "time") {
      const { unit, next } = readUnit(tokens, i + 1, t);
      keys.push(`${t.text}|${unit}`);
      i = next;
      continue;
    }
    if (t.kind === "num") {
      const before = tokens[i - 1];
      if (before?.kind === "word" && adjacent(before, t)) {
        keys.push(`code|${before.text}${t.text}`);
        i += 1;
        continue;
      }
      const sign = signOf(tokens, i);
      const value = digitText(t.text);
      if (value === null) {
        // Can't read it: the characters, the sign AND the unit must all match.
        const { unit, next } = readUnit(tokens, i + 1, t);
        keys.push(`raw|${sign}${t.text.replace(/\s/g, "")}|${unit}`);
        i = Math.max(next, i + 1);
        continue;
      }
      const half = readHalf(tokens, i + 1);
      const { unit, next } = readUnit(
        tokens,
        half.next,
        half.add ? (tokens[half.next - 1] as Token) : t,
      );
      keys.push(`${sign}${value}${half.add}|${unit}`);
      i = next;
      continue;
    }
    if (t.kind === "word" && ARTICLES.has(t.text)) {
      // "a tablet", "un miligramo", "una unidad": one of a dose unit or form.
      const { unit, next } = readUnit(tokens, i + 1, t);
      if (ARTICLE_UNITS.has(unit.split("/")[0] ?? "")) {
        keys.push(`1|${unit}`);
        i = next;
        continue;
      }
    }
    if (t.kind === "word") {
      const times = TIMES_WORDS[t.text];
      if (times !== undefined) {
        keys.push(`${times}|times`);
        i += 1;
        continue;
      }
      const fraction = FRACTION_WORDS[t.text];
      if (fraction !== undefined) {
        // "half a tablet", "half an hour": the article belongs to the unit.
        const skip =
          t.text === "half" && (tokens[i + 1]?.text === "a" || tokens[i + 1]?.text === "an")
            ? 1
            : 0;
        const { unit, next } = readUnit(tokens, i + 1 + skip, tokens[i + skip] as Token);
        keys.push(`${fraction}|${unit}`);
        i = next;
        continue;
      }
      const written = readWrittenNumber(tokens, i);
      if (written !== null) {
        const half = readHalf(tokens, written.next);
        const last = tokens[half.next - 1] as Token;
        const { unit, next } = readUnit(tokens, half.next, last);
        keys.push(`${written.value}${half.add}|${unit}`);
        i = next;
        continue;
      }
    }
    // Any other numeric character (superscripts, other scripts' digits): verbatim only.
    if (t.kind === "other" && /\p{N}/u.test(t.text)) keys.push(`raw|${t.text}`);
    i += 1;
  }
  return keys;
}
