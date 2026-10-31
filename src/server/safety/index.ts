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
 * Rules are written by grammar family, not by phrasing (Codex re-review 3): each one is
 * {subject / clitic placement} × {modal or aspect} × {an explicit list of the verb's forms},
 * with a few known adverbs or intensifiers allowed in between. In Spanish that means the
 * clitic before or after the verb ("no lo puedo despertar" / "no puedo despertarlo"), present
 * continuous ("está despertando", "me estoy ahogando" / "estoy ahogándome") and modals
 * ("puedo", "logro", "está pudiendo"). In English, contractions, slang ("wanna", "gonna") and
 * the -ing forms, spelled out rather than generated ("cut" → "cutting").
 *
 * It is still a finite regex backstop, not understanding: see ADR 0003, "Known limitations".
 *
 * Order matters only for which rule id is reported: medical emergencies are listed first, so
 * a message with both ("he's not breathing, I want to die") gets the emergency steps. Both
 * copies start with 911.
 */

/** Medicines, for the poisoning rules: on their own they're routine ("took his pills"). */
const EN_MEDS = `(?:pills?|tablets?|capsules?|medicines?|medications?|meds|syrup|doses?|acetaminophen|paracetamol|ibuprofen|aspirin|morphine|oxycodone|opioids?|insulin|sleeping pills?)`;
const ES_MEDS = `(?:pastillas?|tabletas?|capsulas?|medicinas?|medicamentos?|jarabe|dosis|paracetamol|acetaminofen|ibuprofeno|aspirinas?|morfina|insulina)`;
/** Substances that are an emergency to swallow whatever the amount. */
const EN_HAZARDS = `(?:bleach|detergent|laundry (?:pods?|soap)|cleaning (?:products?|liquid|fluid|spray)|cleaner|drain cleaner|batter(?:y|ies)|antifreeze|rat poison|poison|pesticide|lye)`;
const ES_HAZARDS = `(?:cloro|lejia|detergente|jabon de (?:ropa|lavadora|platos)|productos? de limpieza|limpiador|pilas?|baterias?|anticongelante|veneno|raticida|insecticida|pesticida)`;
const EN_SWALLOW = `(?:swallowed|drank|ate|ingested|took|chewed|got into|has eaten|has swallowed)`;
const ES_SWALLOW = `(?:se )?(?:tomo|trago|comio|bebio|ingirio)`;
/** A following article/possessive means a body part or object: "cortarme el pelo". */
const ES_NOT_OBJECT = String.raw`(?! (?:el|la|los|las|un|una|mi|mis|su|sus)\b)`;

// ── Spanish grammar pieces ──────────────────────────────────────────────────────────────
/** Object clitic before the verb, third person: "no LO puedo despertar". */
const ES_OBJ = `(?:(?:lo|la|los|las|le|les|se) )?`;
/** Modals: "no PUEDO despertarlo", "no LOGRA respirar", "no CONSIGUE…". */
const ES_MODAL = `(?:puedo|puede|pueden|podemos|pude|pudo|pudimos|podia|logro|logra|logran|logramos|logre|consigo|consigue|conseguimos|consegui|quiere|quiso)`;
/** "estar" for the present continuous: "ESTÁ respirando", "ESTOY ahogándome". */
const ES_ESTAR = `(?:esta|estas|estoy|estan|estamos|estaba|estuvo)`;
/** Adverbs that can sit between the key words: "no puede BIEN respirar", "no respira CASI". */
const ES_ADV = `(?:(?:bien|casi|nada|ya|todavia|aun|mucho|para nada) )?`;
/** {modal | estar (+ "pudiendo") | nothing}, each optionally followed by an adverb. */
const ES_AUX = `(?:(?:${ES_MODAL}|${ES_ESTAR}(?: pudiendo)?) ${ES_ADV})?`;
/** Reflexive clitic: "ME ahogo", "SE ahoga", "TE estás ahogando". */
const ES_REFL = `(?:me|se|te)`;
/** Self-harm intent: "quiero", "voy a", "estoy pensando en", "tengo ganas de"… */
const ES_INTENT = `(?:quiero|quiere|quieres|voy a|va a|vas a|pienso en|piensa en|${ES_ESTAR} pensando en|ganas de|podria|necesito|necesita)`;
/** Self-harm verbs with the clitic attached: "hacerme (mucho) daño", "lastimarme". */
const ES_HARM_ENCLITIC = `(?:hacer(?:me|se|te) (?:(?:mucho|tanto|algo|un) )?dano|lastimar(?:me|se|te)|cortar(?:me|se|te)|herir(?:me|se|te))`;
/** The same verbs with the clitic in front: "me voy a hacer (mucho) daño". */
const ES_HARM_INF = `(?:hacer (?:(?:mucho|tanto|algo|un) )?dano|lastimar|cortar|herir)`;

// ── English grammar pieces ──────────────────────────────────────────────────────────────
/** Self-harm intent: "want to", "gonna", "thinking about", "feel like"… */
const EN_INTENT = `(?:wants? to|wanted to|wanna|going to|gonna|about to|thinking (?:about|of)|think(?:s)? about|might|feel(?:ing)? like|plan(?:ning)? to|trying to|tempted to|urge to|need to)`;
/** Self-harm verbs in every form an intent can take, spelled out ("cut" → "cutting"). */
const EN_HARM = `(?:hurt|hurting|harm|harming|cut|cutting|burn|burning|injure|injuring)`;
/** Ongoing self-harm: "I am / I've been / he keeps cutting himself". */
const EN_ONGOING = `(?:am|i'?m|is|he'?s|she'?s|are|been|keeps?|started|start)`;
const EN_SELF = `(?:myself|himself|herself|themselves|themself)`;

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
      /\b(?:unconscious|unresponsive|passed out|fainted|collapsed|(?:won'?t|will not|can'?t|cannot|couldn'?t|could not|isn'?t|is not|doesn'?t|does not|didn'?t|did not|not|unable to) (?:wake|waking)(?: (?:him|her|them))?(?: up)?|(?:can'?t|cannot|can not|couldn'?t|could not|unable to) (?:get|make) (?:\w+ ){1,3}?(?:to )?wake)\b/,
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
        String.raw`|(?:swallowed|took|taken|ate|drank|had|gave (?:him|her|them)|given|got) (?:\w+ ){0,2}?too (?:many|much) (?:of )?(?:\w+ ){0,2}?${EN_MEDS}` +
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
    // "no respira", "no está (pudiendo) respirar", "no puede bien respirar", "dejó de respirar".
    id: "es.breathing",
    kind: "medical_emergency",
    language: "es",
    pattern: rx(
      String.raw`\b(?:no ${ES_ADV}${ES_AUX}respir(?:a|o|an|amos|aba|aban|ar|ando)` +
        `|(?:deja|dejo|ha dejado|dejaron|esta dejando) de respirar` +
        `|(?:le|me) cuesta (?:mucho )?respirar|dificultad para respirar` +
        String.raw`|${ES_REFL} (?:${ES_ESTAR} )?qued(?:a|o|ando) sin aire)\b`,
    ),
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
    // Clitic either side: "no (lo) puedo despertar(lo)"; continuous: "no está despertando";
    // finite: "no (se) despierta / despertó / ha despertado"; "no logro que despierte".
    id: "es.unresponsive",
    kind: "medical_emergency",
    language: "es",
    pattern: rx(
      String.raw`\b(?:inconsciente|no reacciona|perdio el conocimiento|desmayad[oa]` +
        String.raw`|no ${ES_OBJ}${ES_ADV}${ES_AUX}(?:despertar(?:l[oa]s?|les?|se)?|despertando(?:l[oa]s?|les?|se)?|despiert(?:a|an)|desperto|despertaba)` +
        String.raw`|no ${ES_OBJ}(?:ha|han|hemos|he) despertado` +
        String.raw`|no ${ES_MODAL} (?:hacer )?que (?:se )?despiert(?:e|en)` +
        `|no hay (?:manera|forma) de despertar(?:l[oa]s?|les?)` +
        String.raw`|se (?:${ES_ESTAR} )?desmay(?:o|a|an|ando|ado)|${ES_ESTAR} desmayandose)\b`,
    ),
  },
  {
    // Choking needs the reflexive clitic, before or after: "me ahogo", "se está ahogando",
    // "estoy ahogándome", "se atragantó", "se puede ahogar".
    id: "es.choking",
    kind: "medical_emergency",
    language: "es",
    pattern: rx(
      String.raw`\b(?:${ES_REFL} (?:${ES_ESTAR} )?(?:ahog|atragant)(?:a|as|an|o|ue|e|aba|ando)` +
        String.raw`|(?:${ES_ESTAR} )?(?:ahog|atragant)and(?:ome|ose|ote)` +
        String.raw`|${ES_REFL} (?:${ES_MODAL}|voy a|va a|vas a) (?:ahogar|atragantar)` +
        String.raw`|(?:${ES_MODAL}|voy a|va a|vas a) (?:ahogar|atragantar)(?:me|se|te)` +
        String.raw`|atragantad[oa])\b`,
    ),
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
    // Intent or ongoing, not accidents: "I want to hurt myself", "I've been cutting myself",
    // not "I hurt myself lifting him".
    pattern: rx(
      String.raw`\b(?:${EN_INTENT}|${EN_ONGOING}) (?:\w+ )?${EN_HARM} ${EN_SELF}\b|\bself[- ]harm(?:ing)?\b`,
    ),
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
    // Clitic either side, intensifier allowed: "me voy a hacer (mucho) daño", "estoy pensando
    // en hacerme daño", "quiero lastimarme"; ongoing: "me estoy cortando". An article or
    // possessive after the verb means an object ("cortarme el pelo") and doesn't count.
    id: "es.self_harm.hurt",
    kind: "self_harm",
    language: "es",
    pattern: rx(
      String.raw`\b(?:${ES_INTENT} (?:\w+ )?${ES_HARM_ENCLITIC}${ES_NOT_OBJECT}` +
        String.raw`|(?:me|se|te) ${ES_INTENT} (?:\w+ )?${ES_HARM_INF}${ES_NOT_OBJECT}` +
        String.raw`|(?:me|se|te) ${ES_ESTAR} (?:cortando|lastimando|hiriendo|haciendo (?:(?:mucho|tanto) )?dano)${ES_NOT_OBJECT}` +
        String.raw`|${ES_ESTAR} (?:cortand|lastimand|hiriend)(?:ome|ose|ote)${ES_NOT_OBJECT}` +
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
