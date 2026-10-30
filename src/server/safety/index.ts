import type { Language } from "../types";

/**
 * Deterministic safety pre-check (ADR 0003).
 *
 * Runs FIRST: before the length check, before rate limiting and before any model call, on
 * the raw user text, with keyword/regex lists in EN and ES. Emergencies are never rate-limited.
 * It must be fast, offline and predictable: no network, no model, no randomness.
 * A false positive costs the parent one extra screen; a false negative can cost much more,
 * so the lists lean towards recall.
 *
 * The copy shown on a match is fixed and human-reviewed. It lives in the UI dictionaries
 * (`safety.*` in src/i18n/dictionaries), so it renders even if this API is down.
 */

export type EmergencyKind =
  /** e.g. "not breathing", "seizure", "no despierta", "convulsiona" → 911 */
  | "medical_emergency"
  /** Explicit, imminent self-harm language in EN/ES ("I'm going to kill myself", "me voy a
   * quitar la vida") → 911 + 988. A backstop: the router's `emotional_crisis` is the main layer. */
  | "self_harm";

export type SafetyCheck =
  | { triggered: false }
  | {
      triggered: true;
      kind: EmergencyKind;
      /** Language of the matched pattern, used to pick the fixed message. */
      language: Language;
      /** Id of the rule that matched (never the user's text), safe to log. */
      ruleId: string;
    };

type Rule = { id: string; kind: EmergencyKind; language: Language; pattern: RegExp };

/**
 * Patterns run on normalised text (see normalizeForSafety): lowercase, accents stripped, curly
 * apostrophes made straight, punctuation turned into spaces, whitespace collapsed. So
 * "¡CONVULSIÓN!" and "convulsion" match the same rule, and so do "No... está respirando" and
 * "no esta respirando". Apostrophes are kept for contractions, and every `'` is optional
 * ("isnt", "cant").
 *
 * They cover ordinary grammar, not just one phrasing: third and first person, present
 * continuous ("está/estoy …-ando/-iendo"), clitics ("despertarlo/despertarla"), and EN
 * contractions and slang ("wanna", "gonna", "can't wake him up").
 *
 * Order matters only for which rule id is reported: medical emergencies are listed first, so
 * a message with both ("he's not breathing, I want to die") gets the emergency steps. Both
 * copies start with 911.
 */

/** Medicines, for the poisoning rules: on their own they're routine ("took his pills"). */
const EN_MEDS = `(?:pills?|tablets?|capsules?|medicines?|medications?|meds|syrup|doses?)`;
const ES_MEDS = `(?:pastillas?|tabletas?|capsulas?|medicinas?|medicamentos?|jarabe|dosis)`;
/** Substances that are an emergency to swallow whatever the amount. */
const EN_HAZARDS = `(?:bleach|detergent|laundry (?:pods?|soap)|cleaning (?:products?|liquid|fluid|spray)|cleaner|drain cleaner|batter(?:y|ies)|antifreeze|rat poison|poison|pesticide|lye)`;
const ES_HAZARDS = `(?:cloro|lejia|detergente|jabon de (?:ropa|lavadora|platos)|productos? de limpieza|limpiador|pilas?|baterias?|anticongelante|veneno|raticida|insecticida|pesticida)`;
const EN_SWALLOW = `(?:swallowed|drank|ate|ingested|took|chewed|got into|has eaten|has swallowed)`;
const ES_SWALLOW = `(?:se )?(?:tomo|trago|comio|bebio|ingirio)`;
/** A following article/possessive means a body part or object: "cortarme el pelo". */
const ES_NOT_OBJECT = String.raw`(?! (?:el|la|los|las|un|una|mi|mis|su|sus)\b)`;

const rx = (source: string) => new RegExp(source);

const RULES: readonly Rule[] = [
  // ── EN, medical emergency ─────────────────────────────────────────────────────────────
  {
    id: "en.breathing",
    kind: "medical_emergency",
    language: "en",
    pattern:
      /\b(?:not|isn'?t|is not|aren'?t|ain'?t|wasn'?t|can'?t|cannot|can not|couldn'?t|won'?t|doesn'?t|does not|stopped|stops|barely|struggling to|trouble|difficulty|hard time)\s+(?:\w+\s+)?breath(?:e|es|ing|in)?\b/,
  },
  {
    id: "en.blue",
    kind: "medical_emergency",
    language: "en",
    pattern: /\b(?:turning|turned|going|gone|lips (?:are|look|turned|went)) blue\b|\bblue lips\b/,
  },
  {
    id: "en.seizure",
    kind: "medical_emergency",
    language: "en",
    pattern: /\b(?:seizures?|seizing|convuls(?:ing|ions?|ed|es)|having a fit)\b/,
  },
  {
    id: "en.unresponsive",
    kind: "medical_emergency",
    language: "en",
    pattern:
      /\b(?:unconscious|unresponsive|passed out|fainted|collapsed|(?:won'?t|will not|can'?t|cannot|couldn'?t|could not|isn'?t|is not|doesn'?t|does not|didn'?t|did not|not|unable to) (?:wake|waking)(?: (?:him|her|them))?(?: up)?|can'?t get (?:him|her|them) to wake)\b/,
  },
  {
    id: "en.choking",
    kind: "medical_emergency",
    language: "en",
    pattern: /\bchok(?:ing|es|ed)\b(?! up\b)/,
  },
  {
    id: "en.bleeding",
    kind: "medical_emergency",
    language: "en",
    pattern:
      /\b(?:bleeding (?:a lot|heavily|badly|everywhere)|(?:won'?t|will not|can'?t|cannot) stop (?:the )?bleeding|severe bleeding|heavy bleeding)\b/,
  },
  {
    // Medicines only with overdose / accidental-ingestion context: "he swallowed his medicine
    // as prescribed" is routine. Hazardous substances trigger on their own.
    id: "en.poisoning",
    kind: "medical_emergency",
    language: "en",
    pattern: rx(
      String.raw`\b(?:overdos(?:e|ed|es|ing)` +
        String.raw`|${EN_SWALLOW} (?:\w+ ){0,3}?${EN_HAZARDS}` +
        String.raw`|(?:swallowed|took|ate|drank|had|gave (?:him|her|them)|given|got) (?:\w+ ){0,2}?too (?:many|much) (?:of )?(?:\w+ ){0,2}?${EN_MEDS}` +
        `|accidentally (?:swallowed|took|ate|drank|chewed|got into|gave (?:him|her|them))` +
        String.raw`|${EN_SWALLOW} (?:\w+ ){0,4}?${EN_MEDS}(?: \w+){0,3}? (?:by accident|by mistake)` +
        String.raw`|got into (?:\w+ ){0,2}?(?:${EN_MEDS}|medicine cabinet)` +
        // Someone else's medicine is accidental ingestion, not administration.
        String.raw`|${EN_SWALLOW} (?:my|your|(?:mom|dad|grandma|grandpa|someone else|(?:his|her) (?:brother|sister))'?s) (?:\w+ )?${EN_MEDS}` +
        String.raw`|${EN_SWALLOW} (?:\w+ ){0,2}?(?:whole|entire) (?:bottle|box|pack|packet|strip|blister)(?! of (?:water|juice|milk|soda)\b))\b`,
    ),
  },
  {
    id: "en.allergic",
    kind: "medical_emergency",
    language: "en",
    pattern: /\b(?:anaphyla(?:xis|ctic)|throat is (?:swelling|closing))\b/,
  },

  // ── ES, emergencia médica ─────────────────────────────────────────────────────────────
  {
    id: "es.breathing",
    kind: "medical_emergency",
    language: "es",
    pattern:
      /\b(?:no (?:(?:esta|estoy|puede|puedo|logra|consigue) )?respir(?:a|o|ar|ando)|(?:dejo|ha dejado|dejaron) de respirar|(?:le|me) cuesta (?:mucho )?respirar|dificultad para respirar|se (?:esta )?ahoga(?:ndo)?|ahogandose)\b/,
  },
  {
    id: "es.blue",
    kind: "medical_emergency",
    language: "es",
    pattern: /\b(?:labios (?:morados|azules)|se (?:esta )?(?:puso|poniendo) (?:morad[oa]|azul))\b/,
  },
  {
    id: "es.seizure",
    kind: "medical_emergency",
    language: "es",
    pattern:
      /\b(?:convulsi(?:on|ones|ona|onando|ono|onar)|ataque epileptico|esta convulsionando)\b/,
  },
  {
    id: "es.unresponsive",
    kind: "medical_emergency",
    language: "es",
    pattern:
      /\b(?:inconsciente|no (?:se )?despierta|no (?:puedo|puede|podemos|pude|logro|logramos|consigo) despertar(?:l[oa]s?|le)?|no reacciona|perdio el conocimiento|se (?:desmayo|esta desmayando)|desmayad[oa])\b/,
  },
  {
    id: "es.choking",
    kind: "medical_emergency",
    language: "es",
    pattern: /\b(?:se (?:esta )?atragant(?:o|a|ando)|atragantad[oa])\b/,
  },
  {
    id: "es.bleeding",
    kind: "medical_emergency",
    language: "es",
    pattern:
      /\b(?:(?:sangra|esta sangrando) (?:mucho|sin parar)|no (?:para|deja) de sangrar|sangrado abundante|hemorragia)\b/,
  },
  {
    // Same split as EN: "tomó sus pastillas" is routine; "se tomó todas", "sobredosis",
    // "por accidente" and hazardous substances are not.
    id: "es.poisoning",
    kind: "medical_emergency",
    language: "es",
    pattern: rx(
      String.raw`\b(?:sobredosis|envenen(?:o|ado|ada|amiento)` +
        String.raw`|${ES_SWALLOW} (?:\w+ ){0,3}?${ES_HAZARDS}` +
        `|se (?:tomo|trago|comio|bebio) tod[oa]s` +
        `|${ES_SWALLOW} (?:todo el|toda la|un|el) (?:frasco|bote|caja|blister|sobre)(?: enter[oa])?` +
        String.raw`|(?:${ES_SWALLOW}|le (?:di|dimos|dio|dieron)) (?:\w+ ){0,2}?demasiad[oa]s? (?:de )?(?:\w+ )?${ES_MEDS}` +
        String.raw`|${ES_MEDS}(?: \w+){0,4}? por (?:accidente|error|equivocacion)` +
        String.raw`|${ES_SWALLOW} (?:mis|tus) (?:\w+ )?${ES_MEDS}` +
        `|${ES_SWALLOW} (?:las|los|el|la) ${ES_MEDS} de (?:mi|tu|su) (?:mama|papa|abuel[oa]|herman[oa]|ti[oa])` +
        String.raw`|por (?:accidente|error|equivocacion) (?:\w+ ){0,2}?${ES_SWALLOW})\b`,
    ),
  },
  {
    id: "es.allergic",
    kind: "medical_emergency",
    language: "es",
    pattern: /\b(?:anafila(?:xia|ctic[oa])|se le (?:esta )?cerrando la garganta)\b/,
  },

  // ── EN, explicit self-harm (backstop; the router's emotional_crisis is the main layer) ──
  {
    id: "en.self_harm.kill",
    kind: "self_harm",
    language: "en",
    pattern:
      /\b(?:kill(?:ing)? (?:myself|himself|herself|themselves)(?! (?:to|trying|working|over|for)\b)|suicidal|commit suicide|end (?:my|his|her) (?:own )?life|take (?:my|his|her) (?:own )?life|end it all)\b/,
  },
  {
    id: "en.self_harm.hurt",
    kind: "self_harm",
    language: "en",
    // Intent, not accidents: "I want to hurt myself", not "I hurt myself lifting him".
    pattern:
      /\b(?:want(?:s)? to|wanna|going to|gonna|thinking (?:about|of)|might|feel like) (?:hurt|harm|cut)(?:ing)? (?:myself|himself|herself|themselves)\b|\bself[- ]harm(?:ing)?\b/,
  },
  {
    id: "en.self_harm.die",
    kind: "self_harm",
    language: "en",
    pattern:
      /\b(?:i|he|she|i'?m|i am) (?:(?:really|just|honestly) )?(?:want(?:s)? to|wanna|wanted to) die\b(?! of\b)|\b(?:don'?t|do not|doesn'?t|does not) (?:want to|wanna) (?:be alive|live)(?: anymore)?\b|\bbetter off dead\b|\bwish (?:i|he|she) (?:was|were) dead\b/,
  },

  // ── ES, autolesión explícita ──────────────────────────────────────────────────────────
  {
    id: "es.self_harm.kill",
    kind: "self_harm",
    language: "es",
    pattern:
      /\b(?:(?:matarme|matarse|(?:me|se) (?:voy|va|quiero|quiere) (?:a )?matar)(?! (?:trabajando|estudiando|de)\b)|suicidarme|suicidarse|(?:me|se) (?:voy|va) a suicidar|quitarme la vida|quitarse la vida|(?:me|se) (?:voy|va|quiero|quiere) (?:a )?quitar la vida|acabar con (?:mi|su) vida)\b/,
  },
  {
    id: "es.self_harm.hurt",
    kind: "self_harm",
    language: "es",
    pattern: rx(
      String.raw`\b(?:(?:quiero|quiere|voy a|va a|pienso en|ganas de) (?:hacerme dano|lastimarme|cortarme|hacerse dano|lastimarse|cortarse)${ES_NOT_OBJECT}` +
        `|(?:me|se) (?:voy a|va a|quiero|quiere) (?:hacer dano|lastimar|cortar)${ES_NOT_OBJECT}` +
        String.raw`|autolesion(?:es|arme|arse)?)\b`,
    ),
  },
  {
    id: "es.self_harm.die",
    kind: "self_harm",
    language: "es",
    pattern:
      /\b(?:(?:(?:me|se) (?:quiero|quiere) morir|quiero morir(?:me)?|quiere morir(?:se)?)(?! de\b)|(?:ya )?no (?:quiero|quiere) (?:seguir )?(?:viviendo|vivir)|mejor (?:estaria|estar) muert[oa]|ojala (?:me muera|estuviera muert[oa]))\b/,
  },
];

/**
 * Lowercase, strip accents, straighten apostrophes, turn other punctuation into spaces and
 * collapse whitespace, so punctuation inside a phrase ("no... respira", "¡no respira!") or
 * a missing apostrophe can't hide it.
 */
export function normalizeForSafety(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkEmergency(text: string): SafetyCheck {
  const normalized = normalizeForSafety(text);
  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) {
      return { triggered: true, kind: rule.kind, language: rule.language, ruleId: rule.id };
    }
  }
  return { triggered: false };
}

/** Rule ids, for tests and for tuning from logs. */
export const SAFETY_RULE_IDS: readonly string[] = RULES.map((rule) => rule.id);
