# 0015 — Structural, fail-closed output checks: the dosage gate and a notebook with no AI prose

**Status:** Accepted — signed off by Felipe Calderón on 2026-10-31 after Codex verification (APPROVED WITH DOCUMENTED LIMITATIONS) · revised 2026-10-31 (Phase 2 last fixes, Codex verification). First accepted 2026-10-30 after Codex re-review 4; revision 2 after re-review 5; revision 3 after re-review 6.

*Codex verification of revision 3:* the **notebook** part is **verified by Codex** and unchanged. The dosage part still had blockers (list and quote formatting, use/usa with a later frequency, normalized phone digits). Felipe approved a **number-provenance layer** on top of the dosage rules, with nothing removed (layer g below).

*Revision 3, on Felipe's direction after re-review 6:*
- **Dosage:** label values count whatever follows them, list lines under a heading are one scope, use/usa get the backward check, and Unicode digits are normalised. Remaining vocabulary gaps are listed as known limitations, not closed.
- **Notebook:** redesigned as "AI organizes, the parent's words stay exact". The model no longer writes any text that reaches the page.
- This revision supersedes revision 2's notebook design (verbatim quotes for quantity-like items, `notebook/quantity-like.ts`, now deleted) and its claim that "no model-written quantity can display".

## Context
Two places put model output in front of a parent:
- **Chat answers** go through the dosage gate (`src/server/content-rules.ts`, run by `findUnsafeOutput` before an answer is revealed, ADR 0010). The KB has no dosing instructions, so a dose in an answer means the model added it.
- **The notebook page** (`src/server/notebook/`) turns the parent's notes into a page to bring to an appointment.

**How the notebook design got here.**
- **First design:** the model rephrased the notes into observations and questions, and code checked its numbers against the notes. First the check compared quantities exactly; then (revision 2) any item with anything quantity-like showed the cited notes verbatim instead.
- **What re-review 6 showed:** the guarantee only covered quantities the model *wrote*. A rewrite could silently drop one. "He had 6 seizures overnight" became "He had seizures": a valid, quantity-free item that the check let through, and the note was counted as used. Detection was also never complete. "several", "both", "daily", "IV" and "Comió varias manzanas" all passed as model prose.
- **The conclusion:** checking AI rewrites can't guarantee that nothing is altered or dropped. Taking the rewriting away does.

## Decision

### Notebook: AI organizes, the parent's words stay exact
**The model's job is classification only.** For each note index it returns one topic from a fixed enum (`eating`, `sleep`, `pain_discomfort`, `mood_behavior`, `energy_activity`, `medicines_treatment`, `school_social`, `questions`, `other`) and `isQuestion: boolean`.
- The Zod schema is strict: `{ assignments: [{ index, topic, isQuestion }] }`, with no other keys and no free text anywhere.
- `isQuestion` is required because the provider's strict JSON schema doesn't allow optional fields.
- Prompt v4 asks for exactly this. The notes stay in a delimited `<notes>` data block, with prompt tags stripped.

**Server checks.**
- The output parses.
- Every note index is assigned exactly once: no unknown, duplicate or missing index.
- `finishReason` is `"stop"`.
- Anything else, including a provider error, a timeout or a rate limit, gives the **fallback**: every note under `other`, in date order.

**Response:** `{ safetyNotices, result: { kind: "organized" | "fallback", groups: [{ topic, notes: [{ index, text, createdAt }] }] } }`. A fallback also carries `reason`.
- `text` is the note exactly as the device sent it. It isn't trimmed, and prompt tags are stripped only in the copy sent to the model.
- Groups come in a fixed display order: `questions` first (that's what the parent brings), then the observation topics, then `other`. Only non-empty groups are returned.
- Notes within a group are in date order (the instant `createdAt` names; ties go by index).
- A note with `isQuestion: true` goes under `questions` whatever its topic, so questions are always the parent's own words.
- Topic **labels** come from the dictionaries (`notebook.topics`, EN/ES), never from model text.

**Guarantees, true by construction (no detector involved):**
- Every input note appears **exactly once**, verbatim, with its `createdAt`, in both organized and fallback pages.
- **No model-generated prose is shown.** The only model output that affects the page is an enum value per note, which picks a group.
- So the page can't show an invented, altered or dropped quantity or fact. The worst a bad or injected classification can do is file a note under the wrong heading. Classification accuracy is measured (EVALS.md).

**Safety is unchanged** (ADR 0003). Every recoverable note is scanned before any validation. `safetyNotices` come with organized and fallback results and with 400s, and flagged notes stay on the page.

### Dosage gate: layered structural backstops, accepted over-withholding
**Normalisation first.** Before any rule runs, the text is normalised:
- NFKC (fullwidth "２", "ｍｇ"; "½" becomes "1⁄2");
- every Unicode decimal digit (`\p{Nd}`) is mapped to ASCII ("٢" becomes "2");
- the fraction slash becomes "/";
- dotted clinical abbreviations are joined ("b.i.d." becomes "bid").

Then citation markers are removed and explicit device tablets are masked. Words are compared with accents stripped and case folded.
- "After" means the rest of the sentence or the next **12 words across sentence and line breaks**.
- "Before" means the same sentence, or a nearby **bare fragment**: a sentence or line made only of quantity, frequency, schedule, unit and filler words, like "Twice daily.".
- An answer is withheld if any layer matches.

**Verb rules:**
1. An **administration verb** (give, take, administer, dose, apply, inject; da/dale, toma, administra, aplica, inyecta) followed by a **quantity**. That covers digits, decimals, fractions, signed numbers, written numbers EN/ES, half/medio/media, double/doble/mitad, "a third"/"un tercio", and an article directly before a dose unit or form.
2. An administration verb with a **frequency** after it, or a **schedule** after it:
   - frequencies: every/each/cada + anything; once/twice/N times + a/per/al/por + period; "3x/day"; daily, diario, diariamente; "a day", "al día", "a diario"; clinical abbreviations (q6h, qd, bid, tid, qid…);
   - a period-based frequency or a schedule before the verb in the same sentence counts too ("Every 8 hours, give it", "At bedtime, give it").
3. A quantity **directly followed by a dose unit or form** ("5 ml", "a gram", "2 of the pills"). An unambiguous dose unit or a clinical abbreviation that is never an English or Spanish word also counts on its own ("mg", "q6h", "tid").

**Verb-independent backstops:**
- **(a) Medication context + quantity, frequency or schedule.** Medication context is a generic medication word, a dose form or a dose unit. Examples: "his meds three times weekly", "Capsules.\nTwice daily".
- **(b) Quantity + frequency**, with no medication word needed: "Paracetamol 500 every 6 hours". The numbers inside a frequency don't count as a quantity.
- **(c) Label values (revised).** A label is up to 4 words before a separator.
  - After a strong separator (`:` `—` `–` `|` or a spaced hyphen), a value that **starts** with a quantity, frequency or schedule is withheld **whatever follows**: "Paracetamol: half as needed", "Paracetamol: media si lo necesita", "Morphine: ½ as needed".
  - After a comma, the value must be a run of such words that ends the clause or meets a condition word (as, if, when, for, then, si, cuando, para…): "Acetaminophen, half if needed".
  - With no separator: up to 2 words, then such a run with a frequency or schedule in it ("Paracetamol at night if needed").
  - Not after a separator followed by an opening quote, **if the quoted text has no number, frequency or schedule**: 'decir: "Uno de mis hijos…"' is a quotation (a KB line; "uno de" is a partitive, not a count). 'Paracetamol: "half the usual amount"' is withheld (Codex verification).
- **(d) Schedules.** EN/ES times of day tied to a dose: at bedtime, at night, in the morning(s)/evening(s), with/before/after meals, after breakfast/lunch/dinner, morning and night; al acostarse, al despertar, por la mañana/noche, en las mañanas, antes/después de comer, después del desayuno, en ayunas…
- **(e) use/usa (revised).**
  - They count once something sits between the verb and the frequency or schedule ("Use insulin daily").
  - A frequency or schedule **before** them counts as for any verb ("At bedtime, use it", "Al acostarse, usa eso").
  - A frequency right after the verb belongs to a relative clause ("anything you use every day", "lo que uses a diario").
  - Anything later counts, also after a neuter relative object (Codex verification): "Use what was prescribed daily", "Use whatever was prescribed every morning" and "Use what was prescribed at bedtime" are withheld. "mantener/ponerse al día" means "up to date" and isn't a frequency, so "Usa lo que de verdad vayas a mantener al día" (a KB line) passes.
- **(f) List scope (new).** A heading line (up to 4 words, or ending in a colon) and the next **4** lines that are list items (`-` `•` `*` `1.` `1)`) or bare lines form one scope. An item that starts with a quantity, frequency or schedule is withheld: "Paracetamol\n- half\n- at bedtime", "ibuprofeno\nmedia\npor la noche". The scope ends at a line that is neither a list item nor bare.

**(g) Number provenance (new, Codex verification; chat answers only, in `finalizeAnswer`).** Every **number** and every **frequency or schedule** in a generated answer must also appear in at least one article the answer cites. If not, the answer is withheld with the usual fallback.
- **Shared normalizer** (`numberProvenanceKeys` in `content-rules.ts`): NFKC; Unicode decimal digits to ASCII; Roman numerals II–XII as standalone uppercase tokens (a bare "I" is the EN pronoun); written numbers EN/ES (zero…twenty, the tens, hundred, thousand, dozen; cero/un/una/uno…veinte, the tens, cien, mil); "once" is 11 in both languages (accepted EN false positive); half/media/medio/mitad → 1/2, third/tercio → 1/3, quarter/cuarto → 1/4, double/doble/twice → 2x, triple/thrice → 3x; "1,000"/"1.000" → 1000.
- **Formatting-independent:** the answer and the cited articles (title + body) are each reduced to a **set** of number tokens and frequency/schedule phrase keys. Words are read across sentence and line breaks ("at\nbedtime" is "at bedtime"), and numbers inside a phrase are normalized ("every two hours" = "every 2 hours"). Lists, quotes, newlines and punctuation don't matter. The answer's set must be a subset of the union of the cited articles' sets.
- **Excluded:** citation markers ("[1]") and the service numbers 911 and 988.
- An unsourced number is withheld regardless of formatting. All ten Codex verification blockers are withheld by this layer on its own (`answer/index.test.ts`), and every KB line, cited to its own article, still passes (`kb-content.test.ts`).
- **Accepted cost:** a benign number the cited article doesn't contain is withheld ("Pack 2 changes of clothes [n]"). The check is **set membership, not context**: a number or schedule anywhere in a cited article passes. "1" is in almost every article (one/un/una), and some articles contain "2", "10", "daily", "at night" or "antes de dormir". The rate is measured in Phase 4 (EVALS.md).

**Phone check, normalized (Codex verification).** The phone rules read the same normalized text (NFKC, Unicode digits to ASCII, Unicode hyphens to "-"), keeping the 911/988 and room-number exceptions: "Call ５５５－１２３－４５６７", Arabic-Indic and mixed-script numbers, and "Llama al ２１１" are withheld.

**Narrow exemptions only:**
- harmless objects after take/give, with a frequency or schedule right after them ("take a break every 2 hours", "take a walk after breakfast");
- an explicit device construction ("a tablet with headphones") in a sentence with no administration verb and no number before the tablet;
- an article before a compound object or a hospital unit ("a pill organizer", "una unidad de oncología");
- the service numbers 911 and 988, in any script.

There's no list of drug names. An unknown drug name is caught by the shape around it.

**This is a finite detector, not a closed one.** It recognises the shapes and vocabulary listed above. A dose phrased outside them passes the dosage rules. In a chat answer, number provenance (g) still withholds it if it has a number or schedule the cited article lacks, and the other layers (the KB has no doses, the answer prompt, the fixed medical template for medical questions, the router, and the judge in evals) have to catch it. Known residual vocabulary, tested as still passing the dosage rules (`content-rules.test.ts`, "known limitations"):
- a drug name and a bare quantity with no separator: "Paracetamol half" (provenance withholds it: no article contains a half);
- Roman numerals: "Give II", "Give Ⅱ" (NFKC turns "Ⅱ" into "II", which no dosage rule reads as a number; provenance withholds it unless the cited article contains a 2);
- a harmless take/give clause followed by a quantity: "Take a break, then 5" (provenance withholds it: no article contains a 5);
- fractions and multiples not listed: "a fifth", "quadruple", "un quinto" (not read by provenance either);
- schedule phrasings not listed: "first thing", "with supper", "al mediodía" (not read by provenance either);
- a list value more than 4 lines below its heading, or a heading over 4 words without a colon.

## Consequences
- **Accepted: no AI-polished notebook.** There are no summaries and no rephrased questions. The page is the parent's own notes, sorted under fixed headings, with dates. It's less polished than a rewrite, and it can't misstate a note. Classification quality is measured (EVALS.md § Notebook cases).
- **Accepted: notes are sent to the AI provider for classification.** They're sent with `store: false` and never kept by Lumi (ADR 0005).
- **Accepted over-withholding (dosage).** Harmless answers that match a backstop get the fallback. Measured on a seeded probe set of 40 harmless sentences (`evals/dosage-benign.test.ts`), 10 are withheld:
  - "Room: 211" (also caught by the phone rule as an N11 code; "Room 211" passes);
  - "Floor: 3", "Visiting hours: 9 to 8", "Parking: 2 hours free…";
  - "Note: one thing to remember." (newly withheld by the revised label rule);
  - "Bring:\n- 2 changes of clothes" (list scope);
  - a medicines list within 12 words of an unrelated number;
  - "Use the bathroom every 2 hours";
  - "She drops him off every morning" ("drops" is a dose unit);
  - "Give each child a few minutes alone with you".

  The set is seeded with known triggers, so 25% isn't a representative rate. The KB passes (tested). The withheld rate on real answers is measured in Phase 4.
- **Accepted over-withholding (provenance).** Any benign number, frequency or schedule the cited article lacks gets the fallback (see g). The seeded probe above measures the dosage rules only; the provenance rate on real answers is measured in Phase 4.
- The citation check, buffer → validate → reveal and the fixed medical template are unchanged. The dosage gate stays a **backstop** behind the policy and the router.

## With more time
- **Notebook:** AI-suggested questions shown **separately** from the parent's notes, clearly labelled as suggestions, with guardrails reviewed by clinicians (what may be suggested, how it's worded, what is never suggested). They would never replace or edit a note.
- **Dosage:** a model-based dose classifier as an extra layer (never a replacement), fuzzy matching for misspellings, and the vocabulary items above. Each is driven by what fires in Phase 4 evals, and each needs an ADR.
- **Clinician review** of the fixed medical copy and of what the gate treats as a dose.

## Alternatives
- **Keep AI rewriting with a quantity check (revisions 1–2).** Rejected after re-review 6: a check on what the model wrote can't see what it left out ("6 seizures" → "seizures"), and the detector was never complete.
- **Rewrite, then require every source quantity to reappear.** Rejected: it brings back number parsing (every unit, sign and spelling), and facts other than numbers can still be dropped.
- **No AI at all: notes by date.** That's the fallback page, and it's always available. Classification adds grouping for almost no risk.
- **Keep enumerating phrasings (dosage).** Only cheap vocabulary was added this round. Single phrasings go to the known limitations; structural holes get fixed.
- **Withhold any answer with any number.** Rejected: too many harmless answers (room numbers, ages, "10 minutes alone with you").
