# 0003 — Deterministic safety check before any model call, the length check and rate limits

**Status:** Accepted · 2026-10-30 · *Revised 2026-10-30 after Codex review 1: runs before the length check and rate limiting; adds an explicit self-harm backstop; router gets an `urgent` intent.* · *Revised 2026-10-30 after Codex review 3: broader grammar coverage and punctuation-tolerant normalisation; poisoning needs overdose context for medicines; the notebook shows safety notices alongside the page instead of blocking it (Felipe's decision, approved).* · *Docs revised 2026-10-30 after Codex re-review 4: the router isn't reached past the length and rate limits; known misses as golden cases; future work.* · *Title clarified 2026-11-01: the bounded 8 KB body read runs first (Codex README review); behaviour unchanged.*

## Context
A parent may type something that is a medical emergency ("she's not breathing", "convulsiona"), or say they're about to hurt themselves. The response has to be immediate and correct even if the model provider is slow, down or misclassifies the message, and even if the parent has hit a rate limit or written a very long message.

## Decision
- `src/server/safety` runs **first in the pipeline**, right after the route's bounded 8 KB body read and shape check: before the length check, **before rate limiting** and before any model call. It works on the raw text, normalised (lowercase, accents stripped, punctuation tolerated, whitespace collapsed), with keyword/regex rules in EN and ES that cover ordinary grammar (first and third person, present continuous, clitics, EN contractions and slang). Medicines count as poisoning only with overdose or accidental-ingestion context; hazardous substances (bleach, batteries…) trigger on their own. **Emergencies are never rate-limited.**
- Two kinds:
  - `medical_emergency` → fixed steps: call 911, tell a nurse / press the call button, outside the US contact local emergency services.
  - `self_harm` (explicit, imminent language only, EN + ES) → fixed steps: 911 if anyone is in immediate danger, call or text 988 (Spanish available), outside-US line. This is a **backstop**: the router's `emotional_crisis` intent stays the main layer for everything less explicit.
- **Chat:** on a match the pipeline makes **no model call**. The copy is fixed, human-reviewed and lives in the UI dictionaries (`safety.*`). Rules lean towards recall.
- **Notebook** (`POST /api/notebook/prepare`): the check runs on **every** note, before validation, limits and the model. A note often describes a **past** event ("last night he stopped breathing for a few seconds"), and blocking the page would hurt the parents who most need it. So a match doesn't block: the response is `{ safetyNotices: [...], result }`, the UI shows the fixed emergency steps **first** ("If this is happening now, call 911…"), then the prepared page or the raw-notes fallback. The flagged note is kept and treated like any other note. Notices are returned even when the request is rejected as invalid (400) or rate-limited.
- **Second layer:** the router lists every intent it sees, including `urgent`. Code applies a fixed precedence: **urgent → emotional_crisis → medical → practical → off_topic**. So a mixed message ("what should I pack, also he's not breathing well") goes to the emergency path even if the rules missed it.
- The help page shows static emergency and 988 lines that don't depend on the API.

## Consequences
- Zero latency and zero cost on the most important path, with no prompt-injection surface.
- False positives show emergency steps for a non-emergency. That's acceptable, and the rules are tuned with the golden set (including figurative phrases like "this parking is killing me").
- Keyword lists miss paraphrases. The router's `urgent` / `emotional_crisis` intents are the second layer; this check isn't the only one.
- The rule id (never the text) is logged so misfires can be tuned.
- In the notebook, a flagged note is sent to the model with the others. That's acceptable: the emergency copy is already decided by code and shown first, and the model only classifies the notes (ADR 0015): it writes nothing that is shown.

## Known limitations
*Added 2026-10-30 after Codex re-review 3.*

- **It's a regex backstop with finite coverage.** The rules are now written by grammar family rather than by phrasing: {subject / clitic before or after the verb} × {modal, "estar" + gerund, or none} × {an explicit list of each verb's forms}, with a few adverbs and intensifiers allowed in between ("no lo puedo despertar" / "no puedo despertarlo", "me estoy ahogando" / "estoy ahogándome", "me voy a hacer mucho daño", "I am thinking about cutting myself"). That covers far more than single phrases, but it's still a list. Typos ("resprando"), slang we haven't seen, indirect phrasing ("he's gone grey and floppy") and other languages will get through.
- **The router's `urgent` intent is the second layer.** A chat message this check misses normally goes on to the router, which lists `urgent` and `emotional_crisis` among its intents, and code puts them first. Not always: the length check and the rate limits run after this check and before the router, so an over-long or rate-limited message that doesn't match here never reaches the router. That layer also depends on the provider being up; this one doesn't. In those cases the parent still sees 911 (next point).
- **911 is always on screen and in the fallback copy.** The 911 line is fixed copy in the UI dictionaries (`emergency.banner`), shown by the emergency banner; Phase 3 puts it on every page, and today it's on the help page. Every fallback message ("Lumi can't answer right now") also ends with "In an emergency, call 911". So even a miss here plus a router failure, or a non-matching message stopped by the length or rate limit, leaves the parent one line away from 911.
- **Known false positives, kept on purpose** (recall over precision; each costs one extra emergency screen):
  - "No, está respirando" (punctuation is dropped, so it reads as "no está respirando");
  - "I can't wake up early" (matches "can't wake");
  - "I am not thinking about hurting myself" and "no me voy a hacer daño" (negation isn't parsed);
  - "me ahogo de calor" and similar figurative uses of "ahogarse";
  - "he accidentally took his medicine with lunch", "se tomó todas sus medicinas según las instrucciones" (accidental-ingestion and "todas" patterns).
  They're listed in `src/server/safety/index.test.ts` so a change to them is visible.
- **Known misses are golden cases.** Phrasings a review finds that this check misses go to `evals/golden.jsonl` with `knownLimitation: true` and `detectedBy: "router"` (e.g. "No esta resprando", "No he podido despertarlo", "No consigo que respire", "Me voy a hacer muchísimo daño", "I am unable to breathe"). A test asserts they're still missed, so the flag is dropped when the rules start catching one. Individual phrasings don't block a phase; structural gaps (a whole grammar family) do.

## Future work
*Agreed 2026-10-30 after Codex re-review 4. Not built yet.*

- **Typo-tolerant / fuzzy matching** for the verb and symptom words ("resprando", "convulsonando"), with a measured false-positive budget.
- **A dedicated safety classifier** as an extra layer between this check and the router: still not a replacement, since it's a model call that can fail.
- **Clinician review of the patterns** and of the fixed emergency copy, before any real family uses Lumi.

## Alternatives
- **Let the router classify emergencies.** Rejected as the only layer: depends on the provider being up and on model judgement.
- **Rate-limit first to save CPU.** Rejected: the check is microseconds, and a rate-limited parent in an emergency must still get the steps.
- **Provider moderation endpoint.** Possible extra layer later. It's still a network call, so it can't replace this one.
