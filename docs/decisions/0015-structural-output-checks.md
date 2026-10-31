# 0015 — Structural, fail-closed output checks: the dosage gate and notebook numbers

**Status:** Proposed — pending Felipe's sign-off after Codex verification · revised 2026-10-30 (Phase 2 fixes round 4, Codex re-review 5). First accepted 2026-10-30 after Codex re-review 4.

*Revision 2, on Felipe's direction after re-review 5: restore the verb-independent safety net, since its removal was judged structural; over-withholding is acceptable because the KB has no dosing; converge with designs that are closed by construction, not with more vocabulary.* Supersedes revision 1's "accepted" gaps (verbless doses, unknown notebook units) and the notebook's exact-span comparison (`notebook/quantities.ts`, removed).

## Context
Two code checks stand between model text and the parent:
- **The dosage gate** (`src/server/content-rules.ts`, run by `findUnsafeOutput` before an answer is revealed, ADR 0010). The KB has no dosing instructions, so a dose in an answer means the model added it.
- **The notebook number guarantee** (`src/server/notebook/`, run by `checkNotebook`). The model may only organise and rephrase the parent's notes, so every number on the page must be the parent's.

Revision 1 replaced word lists with structural rules, but every rule still started from an administration verb. Re-review 5 showed that a verbless line still carries a dose ("acetaminophen: half", "his meds three times weekly", "Capsules.\nTwice daily"), and the notebook's span parser still had to know every unit, sign and spelling ("2 sachets" → "2 spoons", "− 5 °C" → "5 °C", "mg/m²" → "mg/m"). A parser that compares numbers has to be right about every way to write one. Taking numbers out of the model's text doesn't.

## Decision

### Dosage gate: layered structural backstops, accepted over-withholding
Citation markers are removed and explicit device tablets are masked first. Words are compared with accents stripped and case folded. "After" means the rest of the sentence or the next **12 words across sentence and line breaks**. "Before" means the same sentence, or a nearby **bare fragment** (a sentence or line made only of quantity, frequency, schedule, unit and filler words, like "Twice daily."). An answer is withheld if any layer matches.

Verb rules (kept from revision 1):
1. An **administration verb** (give, take, administer, dose, apply, inject; da/dale, toma, administra, aplica, inyecta) is followed by a **quantity** of any form: digits, decimals, fractions, signed numbers, written numbers EN/ES, half/medio/media, or an article directly before a dose unit or form.
2. An administration verb has a **frequency** after it (every/each/cada + anything; once/twice/N times + a/per/al/por + period; daily, diario, diariamente; "a day", "al día", "a diario"; clinical abbreviations q6h, q8h, qd, bid, tid, qid…) or a **schedule** after it. A period-based frequency or a schedule before it in the same sentence counts too ("Every 8 hours, give it", "At bedtime, give it").
3. A quantity is **directly followed by a dose unit or form** ("5 ml", "a gram", "2 of the pills"), or an unambiguous dose unit or a clinical abbreviation that is never an English or Spanish word stands alone ("mg", "q6h", "tid", "qid"; "bid" is a word, so it counts only with something else).

Verb-independent backstops (new):
- **(a) Medication context + quantity, frequency or schedule.** Medication context means generic medication words (medicine, medication, meds, drug, prescription, medicina, medicamento, remedio, fármaco), dose forms (tablet, pill, capsule, syrup, injection, patch, drops; pastilla, tableta, cápsula, gotas, jarabe, inyección, parche) and dose units. "his meds three times weekly", "Capsules.\nTwice daily", "Take medicine at bedtime". "Bring the list of medicines your care team gave you" passes: there's no quantity, frequency or schedule.
- **(b) Quantity + frequency**, no medication word needed: "Paracetamol 500 every 6 hours", "5 — twice daily", "2 bid". The numbers inside a frequency ("every 2 hours", "3 times a day") aren't counted as a quantity.
- **(c) Label and list fragments.** A clause of up to 4 words, a separator (`:`, `—`, `–`, `,` or a spaced hyphen), then a tail made only of quantity, frequency or schedule words, for example "acetaminophen: half", "Morphine — 5 — twice daily", "Tablets: half". With no separator: up to 2 words and a tail with a frequency or schedule in it ("Paracetamol every 6 hours"). A tail with only a quantity and no separator ("room 211", "Kept for 30 days") passes.
- **(d) Schedules.** The EN/ES times of day tied to a dose count after an administration verb or near medication context: at bedtime, before bed, in the morning/evening/afternoon, at night, with meals or food, before/after meals or eating, on an empty stomach; al acostarse, antes de dormir, por la mañana/tarde/noche, en la mañana/noche, con las comidas, antes/después de comer, en ayunas.
- **(e) use/usa** counts like the other verbs once something sits between it and the frequency or schedule: "Use insulin daily" and "Usa insulina diariamente" are withheld. A frequency right after the verb belongs to a relative clause ("anything you use every day", "lo que uses a diario"), and so does one after a neuter relative object ("usa lo que vayas a mantener al día"). Those are KB lines and pass.

Narrow exemptions only:
- a short list of harmless objects after take/give, with the frequency directly after them ("take a break every 2 hours", "toma una siesta", "dale un abrazo");
- an explicit device construction ("a tablet with headphones", "tablet (iPad)", "tableta para juegos") in a sentence with no administration verb and no number before the tablet;
- an article before a compound object or a hospital unit ("a pill organizer", "una unidad de oncología");
- the service numbers 911 and 988.

There's no list of drug names. An unknown drug name is caught by the shape around it: a verb, a medication word, a frequency, or a label fragment.

### Notebook: verbatim quotes by construction
Model-written text **never displays a quantity**. If an item's text has anything quantity-like, the item shows the **verbatim text of its cited notes** instead, marked `verbatim: true`. That covers any digit (any script, superscripts, vulgar fractions), any written number EN/ES (including once, dozen, cuarto, medio/media, half, ordinals), any sign or minus symbol, any fraction, ratio, percent or degree symbol, any unit, dose form or measure word, and any article before one ("an international unit", "un sobre", "a dollop of"). Items with none of this keep the model's rephrasing (`verbatim: false`). An item that cites no notes, or a note that doesn't exist, makes the whole page fall back to the raw notes. A topic can't be replaced by a quote, so a quantity-like topic also falls back.

Every number on a prepared page is therefore the parent's own text, in their spelling. No code has to parse, normalise or compare a number. The detector (`notebook/quantity-like.ts`) only has to be **broad**: a false positive costs a rephrasing (the parent sees their own note), and a miss is limited to words outside its lists. The prompt (v3) tells the model to keep quantities out of its own words, since those items will be shown verbatim anyway.

## Consequences
- **Accepted over-withholding (dosage).** Harmless answers that match a backstop get the fallback. Examples: a medication word within 12 words of an unrelated number ("Bring your medicines list. Pack 2 changes of clothes"); "Floor: 3" (a label fragment); "Use the bathroom every 2 hours"; "She drops him off every morning" ("drops" is a dose unit). The KB passes (tested), so an answer that quotes it closely is revealed. The withheld rate on real answers is **measured in Phase 4** (EVALS.md § Tracked for Phase 4).
- **Accepted over-quoting (notebook).** Many items become verbatim quotes, for example any item with a time unit ("all day", "an hour"), a measure phrase ("a cup of", "un poco de") or an ordinal ("the second night"). The page is still organised by topic, with dates and questions. The verbatim share is measured in Phase 4.
- **Residual, by design rather than by gap:**
  - **Dosage:** the gate recognises doses by shape, not meaning. A dose written as prose with none of the shapes (no number, written quantity, frequency, schedule, medication word, dose form or unit, and no administration verb) isn't a dose instruction it can see. The fixed medical template, the router and the judge's boundary criterion remain the other layers.
  - **Notebook:** the notebook can drop a quantity (rephrase "Gave 2 sachets" as "You gave her medicine"). That's an omission, not a wrong number, and the parent's note is still listed by date. The judge checks faithfulness.
- Revision 1's "accepted" gaps are removed. Verbless doses are now caught by backstops a–c, and unknown notebook units no longer matter because nothing is compared.
- The citation check, buffer → validate → reveal and the fixed medical template are unchanged. These checks stay **backstops** behind the policy and the router.

## Alternatives
- **Keep enumerating phrasings or units.** Rejected: every round found another one.
- **Keep the span comparison and add more units.** Rejected: it's correct only if the parser knows every unit and spelling. A verbatim quote is correct without knowing any.
- **A model-based dose classifier.** Possible later as an extra layer. It's another call that can fail or be prompt-injected, so it can't replace a deterministic gate.
- **Withhold any answer with any number.** Rejected: too many harmless answers (room numbers, ages, "10 minutes alone with you"). The backstops need a number *and* a medication, frequency or label shape.
- **Notebook: fall back whenever an item has a number.** Rejected: a verbatim quote keeps the organised page, the topics and the questions, and is just as safe.
