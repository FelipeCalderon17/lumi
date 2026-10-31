import { DOSE_FORMS, DOSE_UNITS, WRITTEN_NUMBERS } from "../content-rules";

/*
 * Notebook numbers are correct BY CONSTRUCTION (ADR 0015): model-written text never shows a
 * quantity. If an item's text has anything quantity-like, the page shows the cited notes'
 * own words instead (see checkNotebook). So this check only has to be broad, never exact: a
 * false positive costs a rephrasing (the parent sees their own note), a miss would let the
 * model state a number. It works on text folded to plain lowercase letters (NFKC, accents
 * stripped), so fullwidth digits, "ｍｇ" and "Ñ" are handled once.
 */

/** Not a letter or digit, either side. */
const B = String.raw`(?<![\p{L}\p{N}])`;
const E = String.raw`(?![\p{L}\p{N}])`;

/** Any digit of any script, superscripts, vulgar fractions and Roman numeral signs. */
const DIGIT = /\p{N}/u;

/** Sign, minus, fraction, ratio, percent and degree symbols. */
const SYMBOL = /[+±∓−＋－﹢﹣⁺⁻₊₋‒/⁄∕∶÷×%‰°º]/u;
/** ASCII hyphen or en dash used as a sign or a range: anywhere except inside a word. */
const DASH = /(?<!\p{L})[-–]|[-–](?!\p{L})/u;

/** Written numbers beyond the dose gate's list: ordinals, multiples and collective counts. */
const MORE_NUMBERS =
  "first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|twentieth|hundredth|thousandth|halves|quarters|thirds|double|triple|single|couple|pair|pairs|dozens|score" +
  "|primer|primero|primera|primeros|primeras|segundos?|segundas?|tercer|terceros?|terceras?|cuartos?|cuartas?|quintos?|quintas?|sextos?|sextas?|septimos?|septimas?|octavos?|octavas?|novenos?|novenas?|decimos?|decimas?|medios|medias|mitad|mitades|tercios?|doble|triple|par|pares|docenas?|decenas?|centenar|centenares|millon|millones";

/**
 * Units, dose forms and measures. Includes time units ("an hour"), temperature, weight, length
 * and household measures ("a spoon", "un sobre"), on top of the dose gate's units and forms.
 */
const MEASURES =
  "spoons?|spoonfuls?|cuchara|cucharas|cucharon|cucharones|cucharadita|scoops?|sachets?|sobres|vials?|viales|ampoules?|ampules?|ampollas?|bags?|bolsas?|cups?|cupfuls?|tazas?|glass(?:es)?|vasos?|bottles?|botellas?|sips?|sorbos?|bites?|bocados?|mouthfuls?|handfuls?|shots?|sprays?|patch(?:es)?|parches?|injections?|inyeccion(?:es)?|pumps?|dollops?|capfuls?|servings?|porci(?:on|ones)|raciones?|piezas?|pieces?" +
  "|seconds?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?|minutos?|horas?|dias?|semanas?|mes|meses|anos?" +
  "|degrees?|grados?|celsius|fahrenheit|centigrados?|centigrade|kgs?|kilos?|kilograms?|kilogramos?|lbs?|pounds?|libras?|oz|ounces?|onzas?|cm|mm|meters?|metres?|metros?|inch(?:es)?|pulgadas?|lit(?:er|re)s?|litros?|mmhg|bpm|meq|mmol|percent|porciento";

/** Ambiguous words that count only after an article: ES "sobre" is also "about". */
const ARTICLE_ONLY_MEASURES = "sobre";

const ARTICLE = "a|an|one|un|una|uno";
const UNIT_WORD = `${DOSE_UNITS}|${DOSE_FORMS}|${MEASURES}`;

/** Any quantity word on its own. */
const QUANTITY_WORDS = new RegExp(
  `${B}(?:${WRITTEN_NUMBERS}|${MORE_NUMBERS}|medio|media|un cuarto|un tercio|${UNIT_WORD})${E}`,
  "u",
);
/** An article directly before a unit, a dose form or a measure: "an hour", "un sobre". */
const ARTICLE_UNIT = new RegExp(
  `${B}(?:${ARTICLE})\\s+(?:${UNIT_WORD}|${ARTICLE_ONLY_MEASURES})${E}`,
  "u",
);
/** "a <noun> of" is how English and Spanish measure things: "a dollop of", "un poco de". */
const MEASURE_PHRASE = /(?<![\p{L}\p{N}])(?:a|an|un|una)\s+\p{L}+\s+(?:of|de)(?![\p{L}\p{N}])/u;

export function fold(text: string): string {
  return text
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();
}

/**
 * True if the text has anything that could state a quantity: a digit, a sign or ratio symbol,
 * a written number (EN/ES, incl. "once", "dozen", "cuarto", "medio", "half"), a unit, dose form
 * or measure word, or an article before one ("an international unit").
 */
export function hasQuantityLike(text: string): boolean {
  const folded = fold(text);
  return (
    // The raw text too: NFKC turns "Ⅻ" into letters.
    DIGIT.test(text) ||
    DIGIT.test(folded) ||
    SYMBOL.test(folded) ||
    DASH.test(folded) ||
    QUANTITY_WORDS.test(folded) ||
    ARTICLE_UNIT.test(folded) ||
    MEASURE_PHRASE.test(folded)
  );
}
