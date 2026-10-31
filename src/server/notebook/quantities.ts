/**
 * Quantities in notebook text, for the "no invented numbers" check (Codex re-review 3).
 *
 * FAIL CLOSED. Every numeric thing in a text becomes a key, and an item's keys must all appear
 * in the notes it cites:
 *   - "value|unit": the value from digits ("2.5", "2,5"), fractions ("1/2", "½"), clock times
 *     ("8:30") or written numbers EN/ES ("fifty", "treinta y cinco", "half", "media"), and the
 *     full canonical unit after it. Units stay distinct ("°C" ≠ "°F" ≠ "degrees", "mL" ≠ "mg"),
 *     compound units stay whole ("mL/kg", "mg per kg" → "ml/kg", "mg/kg"), and letters glued
 *     to a number keep their spelling ("5mEq" → "5|meq") even if we don't know the unit.
 *     A plain word after the number ("3 kids") is no unit: "3|".
 *   - "raw|…" for anything we can't read confidently: "1,000" (thousands or decimal?),
 *     "1.2.3", "5/0", "²". It only passes if the cited note has the very same characters.
 *   - "code|…" for letters followed by digits ("B12", "x2"): same, verbatim only.
 * So "38 °C" → "38 °F", "1/2 tablet" → "2 tablets", "5 ml" → "fifty ml" and "five
 * milliliters" from a note without numbers all fail, and the page falls back to the raw notes.
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
const FRACTION_WORDS: Record<string, number> = { half: 0.5, medio: 0.5, media: 0.5, quarter: 0.25 };
/** Words that are a count of times: "twice" = "2 times" = "dos veces". */
const TIMES_WORDS: Record<string, number> = { twice: 2, thrice: 3 };
const FRACTION_CHARS: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
};

type Token = {
  kind: "time" | "num" | "word" | "sym" | "other";
  text: string;
  start: number;
  end: number;
};

const TOKEN =
  /(\d{1,2}:\d{2})|(\d+(?:[.,]\d+)*(?:\/\d+(?:[.,]\d+)*)?[½¼¾⅓⅔]?|[½¼¾⅓⅔])|([\p{L}µ]+)|([°º%/-])|(\S)/gu;

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

/** Stable text for a value, so 1/3 on both sides compares equal. */
const show = (value: number) => String(Number(value.toFixed(6)));

/** The value of a digit token, or null when it can't be read confidently. */
function digitValue(text: string): number | null {
  const fraction = FRACTION_CHARS[text.slice(-1)];
  const body = fraction === undefined ? text : text.slice(0, -1);
  if (body === "") return fraction ?? null;
  if (body.includes("/")) {
    const [a = "", b = ""] = body.split("/");
    if (fraction !== undefined || !/^\d+$/.test(a) || !/^\d+$/.test(b) || Number(b) === 0) {
      return null;
    }
    return Number(a) / Number(b);
  }
  if (/^\d+$/.test(body)) return Number(body) + (fraction ?? 0);
  // "2.5", "2,5": one separator. Exactly three digits after it ("1,000") could be thousands.
  const decimal = /^\d+[.,](\d+)$/.exec(body);
  if (decimal && fraction === undefined && decimal[1]?.length !== 3) {
    return Number(body.replace(",", "."));
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

/** "and a half" / "y medio/media" after a number. */
function readHalf(tokens: Token[], i: number): { add: number; next: number } {
  const [a, b, c] = [tokens[i]?.text, tokens[i + 1]?.text, tokens[i + 2]?.text];
  if (a === "and" && b === "a" && c === "half") return { add: 0.5, next: i + 3 };
  if (a === "y" && (b === "medio" || b === "media")) return { add: 0.5, next: i + 2 };
  return { add: 0, next: i };
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
      const value = digitValue(t.text);
      if (value === null) {
        keys.push(`raw|${t.text}`);
        i += 1;
        continue;
      }
      const half = readHalf(tokens, i + 1);
      const { unit, next } = readUnit(
        tokens,
        half.next,
        half.add ? (tokens[half.next - 1] as Token) : t,
      );
      keys.push(`${show(value + half.add)}|${unit}`);
      i = next;
      continue;
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
        keys.push(`${show(fraction)}|${unit}`);
        i = next;
        continue;
      }
      const written = readWrittenNumber(tokens, i);
      if (written !== null) {
        const half = readHalf(tokens, written.next);
        const last = tokens[half.next - 1] as Token;
        const { unit, next } = readUnit(tokens, half.next, last);
        keys.push(`${show(written.value + half.add)}|${unit}`);
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
