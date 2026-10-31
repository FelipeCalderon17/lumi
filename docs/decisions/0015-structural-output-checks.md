# 0015 — Structural, fail-closed output checks: the dosage gate and notebook quantities

**Status:** Accepted · 2026-10-30 · *From Codex re-review 4, on Felipe's direction for Phase 2 fixes round 3: regex checks are backstops, only structural gaps block, and rare phrasings go to the golden set and known limitations.* Supersedes the enumerative rules from re-review 3 (the drug-name window and the entertainment-word device masking in the dosage gate; value-based comparison in the notebook check).

## Context
Two code checks stand between model text and the parent:
- **The dosage gate** (`src/server/content-rules.ts`, run by `findUnsafeOutput` before an answer is revealed, ADR 0010). The KB has no dosing instructions, so a dose in an answer means the model added it.
- **The notebook quantity check** (`src/server/notebook/quantities.ts`, run by `checkNotebook`). The model may only organise and rephrase the parent's notes, so every number on the page must come from a cited note.

Each review round found another phrasing the rules didn't list: a drug name not in the list, a device word that masked a real dose ("Give a tablet for pain while watching cartoons"), a sign that was dropped, a unit that wasn't bound to an unreadable number. Adding words to lists doesn't converge.

## Decision
Replace enumeration with a few structural rules that **fail closed**.

**Dosage gate.** An answer is withheld if:
1. an **administration verb** (give, take, administer, dose, apply, inject, use; da/dale, toma, administra, aplica, inyecta, usa) is followed by a **quantity** of any form: digits, decimals, fractions, signed numbers, written numbers EN/ES (including ES "once" = 11), half/medio/media, or an article directly before a dose unit or form;
2. an administration verb has a **frequency** of any form after it (every/each/cada + anything; once/twice/N times + a/per/al/por + period; daily, nightly, diario, diariamente; "a day", "al día"), or a period-based frequency before it in the same sentence ("Every 8 hours, give it");
3. a quantity, articles included, is **directly followed by a dose unit or form** ("a gram", "a teaspoon", "5 international units", "once pastillas", "2 of the pills"), or an unambiguous dose unit stands alone ("mg");
4. a dose unit or form word has a frequency in the same sentence ("the pills every other day").

"After" means the rest of the sentence, or the next 12 words across sentence and line breaks ("Take paracetamol. Every 8 hours"). There's no list of drug names. Two narrow exemptions only:
- **Harmless objects after take/give**, a short explicit list: take a break / nap / walk / rest / photo / shower / seat / snack / notes / time / leave; toma un descanso / una siesta / una foto / pausas; dale un abrazo; give them time. So "take a break every 2 hours" passes.
- **An explicit device construction**: "tablet (iPad)", "tablet computer", "tableta electrónica", or a tablet followed by with/or/for/con/para… and a screen or audio word ("a tablet with headphones", "una tableta para juegos"). It counts only in a sentence with no administration verb and no number before the tablet. "Dale una tableta antes de ver películas" is withheld.

"use"/"usa" count only with a quantity, never with a frequency, because "anything you use every day" and "lo que uses a diario" are KB packing lines.

**Notebook quantities.** Every numeric token (digits with `, . / -` separators, a leading sign, written numbers EN/ES) and every article before a dose unit or form ("a tablet", "un miligramo", "una unidad") becomes one **span**: the sign, the value and the whole unit after it ("mL/kg", "°C"). Each span must appear in a note the item cites. Only trivially safe spellings are equivalent: "2,5" = "2.5" = "2.50", "½" = "1/2" = "1 / 2" = "half", "three" = "3", "a tablet" = "one tablet", "5 mg" = "5 milligrams". Values are compared **as text**: fractions aren't reduced ("2/4" ≠ "1/2", "120/80" ≠ "150/100") and decimals aren't rounded. Anything it can't read ("1,000", "1.000", "1.2.3", "5/0") must match verbatim, **with its sign and its unit**. Anything not found means the raw-notes fallback.

## Consequences
- **Accepted over-withholding.** Some harmless answers get the fallback: an administration verb near any number or "every…" ("give each child…", "Give the nurse your list. Once you're settled…"), or "take a day off every week". The KB passes (tested), so an answer that quotes it closely is revealed. The withheld rate on real answers is **measured in Phase 4** (EVALS.md § Tracked for Phase 4) and the exemption list is tuned from it, not guessed.
- **Accepted extra notebook fallbacks.** A rephrased fraction ("1.5" for "1½"), an unbound plain word, or a reordered unit falls back to the raw notes, which are still a useful page. Also measured in Phase 4.
- **Known gaps, tested so a change is visible:** a quantity with no verb, unit or dose form next to it ("acetaminophen: half", "his meds three times weekly"). These go to the golden set and evals, not to more patterns. In the notebook, a number followed by a word that isn't a known unit is compared without that word ("2 sachets" vs "2 spoons").
- The citation check, buffer → validate → reveal and the fixed medical template are unchanged. These checks stay **backstops** behind the policy and the router.

## Alternatives
- **Keep enumerating phrasings.** Rejected: every round found another one.
- **A model-based dose classifier.** Possible later as an extra layer. It's another call that can fail or be prompt-injected, so it can't replace a deterministic gate.
- **Withhold any answer with any number.** Rejected: too many harmless answers (room numbers, ages, "10 minutes alone with you").
