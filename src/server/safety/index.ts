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
 * Patterns run on normalised text: lowercase, accents stripped, curly apostrophes made
 * straight, whitespace collapsed. So "CONVULSIÓN" and "convulsion" match the same rule.
 *
 * Order matters only for which rule id is reported: medical emergencies are listed first, so
 * a message with both ("he's not breathing, I want to die") gets the emergency steps. Both
 * copies start with 911.
 */
const RULES: readonly Rule[] = [
  // ── EN, medical emergency ─────────────────────────────────────────────────────────────
  {
    id: "en.breathing",
    kind: "medical_emergency",
    language: "en",
    pattern:
      /\b(?:not|isn'?t|is not|aren'?t|can'?t|cannot|can not|couldn'?t|stopped|stops|struggling to|trouble|difficulty|hard time)\s+(?:\w+\s+)?breath(?:e|es|ing)?\b/,
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
      /\b(?:unconscious|unresponsive|passed out|fainted|collapsed|(?:won'?t|will not|can'?t|cannot|isn'?t|not) (?:wake|waking)(?: (?:him|her|them))?(?: up)?)\b/,
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
      /\b(?:bleeding (?:a lot|heavily|badly|everywhere)|(?:won'?t|will not|can'?t) stop (?:the )?bleeding|severe bleeding|heavy bleeding)\b/,
  },
  {
    id: "en.poisoning",
    kind: "medical_emergency",
    language: "en",
    pattern:
      /\b(?:overdose[sd]?|swallowed (?:\w+ )?(?:pills|medicine|medication|tablets|bleach|batter(?:y|ies))|took too many (?:pills|tablets))\b/,
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
      /\b(?:no (?:puede )?respira|dejo de respirar|le cuesta (?:mucho )?respirar|dificultad para respirar|no puede respirar|se (?:esta )?ahoga(?:ndo)?|ahogandose)\b/,
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
    pattern: /\b(?:convulsi(?:on|ones|ona|onando|ono)|ataque epileptico|esta convulsionando)\b/,
  },
  {
    id: "es.unresponsive",
    kind: "medical_emergency",
    language: "es",
    pattern:
      /\b(?:inconsciente|no (?:se )?despierta|no reacciona|perdio el conocimiento|se desmayo|desmayad[oa])\b/,
  },
  {
    id: "es.choking",
    kind: "medical_emergency",
    language: "es",
    pattern: /\b(?:se atraganto|atragantad[oa]|se esta atragantando)\b/,
  },
  {
    id: "es.bleeding",
    kind: "medical_emergency",
    language: "es",
    pattern:
      /\b(?:sangra (?:mucho|sin parar)|no (?:para|deja) de sangrar|sangrado abundante|hemorragia)\b/,
  },
  {
    id: "es.poisoning",
    kind: "medical_emergency",
    language: "es",
    pattern:
      /\b(?:sobredosis|se (?:tomo|trago) (?:\w+ )?(?:pastillas|medicinas|medicamentos|cloro|pilas?))\b/,
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
      /\b(?:want(?:s)? to|going to|gonna|thinking (?:about|of)|might|feel like) (?:hurt|harm|cut)(?:ing)? (?:myself|himself|herself|themselves)\b|\bself[- ]harm(?:ing)?\b/,
  },
  {
    id: "en.self_harm.die",
    kind: "self_harm",
    language: "en",
    pattern:
      /\b(?:i|he|she) (?:want|wants|wanna) to die\b(?! of\b)|\b(?:don'?t|do not|doesn'?t|does not) want to (?:be alive|live)(?: anymore)?\b|\bbetter off dead\b/,
  },

  // ── ES, autolesión explícita ──────────────────────────────────────────────────────────
  {
    id: "es.self_harm.kill",
    kind: "self_harm",
    language: "es",
    pattern:
      /\b(?:(?:matarme|matarse|me voy a matar|se va a matar)(?! (?:trabajando|estudiando|de)\b)|suicidarme|suicidarse|me voy a suicidar|quitarme la vida|quitarse la vida|(?:me|se) (?:voy|va|quiero|quiere) (?:a )?quitar la vida|acabar con (?:mi|su) vida)\b/,
  },
  {
    id: "es.self_harm.hurt",
    kind: "self_harm",
    language: "es",
    pattern:
      /\b(?:quiero|quiere|voy a|va a|pienso en|ganas de) (?:hacerme dano|lastimarme|cortarme|hacerse dano|lastimarse|cortarse)\b|\bautolesion(?:es|arme|arse)?\b/,
  },
  {
    id: "es.self_harm.die",
    kind: "self_harm",
    language: "es",
    pattern:
      /\b(?:(?:quiero morir(?:me)?|quiere morir(?:se)?)(?! de\b)|no quiero (?:seguir )?(?:viviendo|vivir)|mejor (?:estaria|estar) muert[oa])\b/,
  },
];

/** Lowercase, strip accents, straighten apostrophes, collapse whitespace. */
export function normalizeForSafety(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
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
