# Lumi: a little light for the long nights

> *Una lucecita para las noches largas.*

A prototype website for **Lumi**, a fictional foundation supporting families of children with cancer, built for the FutureProofing take-home ([brief](docs/BRIEF.md)).

> **Status:** Phase 2, server side. The assistant pipeline, voice-to-text, the notebook, gaps and staff endpoints work behind tests and a first live smoke test. The UI is next (Phase 3).
>
> **Live demo:** _TODO: Railway URL after Phase 3._

## What it is

A bilingual (English/Spanish) site for families in the US, where the one deep part is a **Family Support Assistant**: a parent can ask a practical question at any hour ("How do I talk with my other kids about this?", "¿Qué llevo para la primera noche en el hospital?") and get a short, warm answer written using a small library of guides for families, with links to those guides. Citation checks verify that the linked guides exist; they do not guarantee that every statement is supported. Answers are checked before they're shown. When Lumi doesn't know, it says so and points to a person. Medical questions always go to the care team, with a fixed, reviewed message.

Behind it, a small **staff view** lists questions Lumi couldn't answer, saved only when a parent chooses to share them after seeing and editing exactly what will be stored. Questions older than 30 days are deleted when someone saves a question or staff opens the list. The team uses shared questions to decide which guides to write next.

Landing, donate and volunteer are placeholders.

## Why this slice

_TODO (fill in after Phase 2)._ Outline:

- Of the foundation's three goals (support families, raise funds, recruit volunteers), support is where AI can help most and harm most. That's where the judgement is.
- A stressed parent at 2 a.m. can't wait for office hours, doesn't want to search a PDF, and may be more comfortable in Spanish.
- A grounded, citing, abstaining assistant is useful on day one with 12 well-written guides, and the gaps view makes it grow where families actually need it.

## What I left out and why

_TODO._ Outline: accounts/login, conversation history, donations processing, volunteer sign-up flow, CMS for articles, vector search (ADR 0002), real staff auth (ADR 0008), medical content of any kind.

## Tradeoffs & known limitations

Lumi is a functional demo built for a take-home; these are the known gaps, documented on purpose.

Every tradeoff is a conscious, time-boxed choice for a prototype. Each is recorded in an ADR or in [EVALS.md § Tracked limitations](docs/EVALS.md#tracked-limitations), and this table collects them in one place.

| Tradeoff | What we accepted | Why | With more time |
|---|---|---|---|
| **Regex safety check as a backstop, in 3 layers** ([ADR 0003](docs/decisions/0003-deterministic-safety-precheck.md)) | Emergencies and explicit self-harm are caught by a deterministic regex check written by grammar family. It's still a finite list: typos ("resprando"), slang, indirect phrasing and other languages get through. Layer 2 is the router's `urgent` / `emotional_crisis` intents. Layer 3: 911 is always on screen and in every fallback message. Known misses are golden cases flagged `knownLimitation`. | Zero latency, zero cost, no prompt-injection surface, works when the provider is down. A model can't be the only safety layer. | Fuzzy/typo-tolerant matching with a false-positive budget; a dedicated safety classifier as an extra layer; clinician review of the patterns. |
| **Safety false positives kept on purpose** (ADR 0003) | "No, está respirando", "I can't wake up early", negated self-harm phrases and figurative "ahogarse" show the emergency steps. | Recall over precision: each false positive costs one extra emergency screen. A miss could cost far more. | Negation and punctuation handling, measured against the golden set before shipping. |
| **Router unreachable after the length or rate limit** (ADR 0003) | An over-long or rate-limited message that the regex check misses never reaches the router's `urgent` layer. | Limits protect cost and capacity. The safety check runs before them, and 911 is still shown in the fallback copy and the banner. | A cheap, local second classifier that also runs before limits. |
| **Dosage over-withholding** ([ADR 0015](docs/decisions/0015-structural-output-checks.md)) | Harmless answers that look like a dose get the fallback: "Room: 211" (trips both the phone and dosage rules; "Room 211" passes), "Floor: 3", "Note: one thing to remember.", "Use the bathroom every 2 hours", "drops him off every morning". Measured: 10 of 40 seeded harmless sentences (`evals/dosage-benign.test.ts`). | The KB has no dosing, so a dose in an answer is always the model's addition. Withholding a harmless answer costs a fallback message; revealing a dose could hurt a child. | Measure the withheld rate on real answers (Phase 4) and tune exemptions from what actually fires, each with an ADR. |
| **Dosage gate is a finite detector** (ADR 0015, EVALS) | It catches doses by shape and listed vocabulary, after Unicode normalisation. The dosage rules alone still pass "Paracetamol half", Roman numerals ("Give II"), "Take a break, then 5", "a fifth", "quadruple", "first thing", "with supper", "al mediodía". In a chat answer, number provenance (next row) now withholds the first three unless the cited guide contains that number. The rest pass both layers. | Every review round found phrasings the rules missed, and more surely exist: the rules are a finite list, not a proof. Number provenance backs them up for numbers and schedules. Remaining phrasings are documented and tested. The KB, the prompt, the fixed medical template and the router are the other layers. |
| **Number provenance withholds benign numbers** (ADR 0015) | Every number, frequency and schedule in a chat answer must also appear in a guide it cites, after normalization (Unicode digits, written numbers EN/ES, Roman II–XII, half/media → 1/2, twice/doble → 2x). Otherwise the answer is withheld. False positives: a benign number the cited guide lacks gets the fallback ("Pack 2 changes of clothes" citing a guide with no "2"), and so does EN "once you arrive" (read as 11). It checks set membership, not context: a number or schedule anywhere in the cited guide passes. "1" is in almost every guide (one/un/una), and some guides contain "2", "10", "daily", "at night" or "antes de dormir". Ordinals and fractions outside the list ("fifth", "quinto") aren't read as numbers, and neither is a bare "I". | An unsourced number is withheld regardless of formatting (lists, quotes, line breaks). One simple rule covers what the phrasing rules keep missing. | Measure the false-positive rate on real answers (Phase 4); context-aware provenance (the number together with the word it counts). |
| **List-scope bounds and quotation handling** (ADR 0015) | The dosage rules read a list as one scope only within 4 lines under a heading of up to 4 words, or under a heading ending in a colon. A value further down, or under a longer heading, isn't caught by those rules. Label parsing is skipped after an opening quote, but only when the quoted text has no number, frequency or schedule ('decir: "Uno de mis hijos…"' is a KB line). | Bounds keep ordinary lists and quotations passing. Number provenance doesn't depend on layout, so it still catches an unsourced number beyond the bounds. | Parse the Markdown structure instead of counting lines. | A model-based dose classifier as an extra layer (never a replacement); fuzzy matching; clinician review of what counts as a dose. |
| **Notebook without AI rewriting** (ADR 0015) | The model only sorts notes into fixed topics. There are no AI summaries and no AI-polished questions: the page is the parent's own notes, verbatim, with dates, under fixed headings. | AI rewriting with validation was tried first, and the reviewer showed it could silently drop "6 seizures". Without rewriting, no note can be invented, altered or dropped, by construction. | AI-suggested questions shown **separately**, clearly labelled as suggestions, with clinician-reviewed guardrails. Never edits a note. |
| **Notebook notes are processed by OpenAI; a note can be misfiled** ([ADR 0005](docs/decisions/0005-no-conversation-storage.md), ADR 0015) | Notes stay on the device and Lumi stores none of them, but "prepare" sends them to OpenAI for one classification call (`store: false`). A note may land under the wrong heading. | Grouping by topic helps at an appointment. A misfiled note is still shown verbatim, and classification accuracy is measured in evals. | On-device classification; a processing notice on the notebook page (Phase 3); a "move to…" control for the parent. |
| **Whole KB in context, no vector DB** ([ADR 0002](docs/decisions/0002-whole-kb-in-context.md)) | Every answer pays for the full KB as input tokens. Prompt caching is best-effort, not guaranteed, and an article edit invalidates it until it warms. | 12 short articles per language fit easily. No retrieval step that can miss, and no embeddings pipeline. | Hybrid retrieval (BM25 + embeddings) with the same citation contract, at ~200 articles. |
| **Buffer → validate → reveal** ([ADR 0010](docs/decisions/0010-buffer-validate-reveal.md)) | The parent waits for the full answer (a calm progress state) instead of watching it stream. `answerTotalMs` (25 s) is the ceiling. | No model text reaches the parent before it passes the completion, citation and output checks, so nothing is ever withdrawn. | Stream sentence by sentence, each validated before it's shown, if the checks can run per sentence. |
| **Valid citation ≠ grounded claim** ([ADR 0010](docs/decisions/0010-buffer-validate-reveal.md), [ARCHITECTURE](docs/ARCHITECTURE.md#what-citation-integrity-does-and-doesnt-guarantee)) | Code checks that cited guides exist, not that each sentence is supported. An unsupported claim next to a real citation can reach the parent. | Grounding can't be checked deterministically. It's reduced by the prompt and the fixed medical path, and measured by the judge. | Sentence-level support checking before reveal, if latency allows. |
| **Generic fixed medical template** ([ADR 0011](docs/decisions/0011-medical-fixed-template.md)) | Every medical question gets the same reviewed copy and a link to "Questions to ask your care team", whatever was asked. A medical question the router misclassifies as `practical` reaches generation, where only the prompt, the output checks and the evals guard the boundary. | No generated text on the clinical path, so there's nothing to hallucinate there. | Per-topic reviewed templates; measure misclassification on the golden set (Phase 4); a second classifier for the medical boundary. |
| **Provisional model selection and output caps** ([ADR 0009](docs/decisions/0009-model-selection.md)) | The models and the output caps (router 1,000, answer 3,000, notebook 4,000 tokens, reasoning included) are provisional. ADR 0009 is still Proposed. | The comparison that decides them is paid and is part of the Phase 4 evals. | Run the comparison, then set models and caps from measured quality, latency, cost and reasoning tokens. |
| **Eval runner not implemented yet** ([EVALS.md](docs/EVALS.md), Phase 4) | `pnpm eval` is a stub. The golden set and the free deterministic checks run in `pnpm test`. The LLM judge, the model comparison and real-answer rates (dosage withholding, provenance false positives, misclassification) aren't measured yet. | Phase 4 work, run by Felipe because it costs money. | Phase 4: the runner, the budget guard and a results table in EVALS.md. |
| **Lazy 30-day purge** (ADR 0005) | Gap questions older than 30 days are deleted on the next save or staff list request, so with no traffic they can stay longer. | No scheduler or extra service for a prototype. The disclosure says exactly this. | A scheduled purge job (cron or a Postgres job). |
| **Tab-bound delete credentials** (ADR 0005) | The parent's one-time delete token lives in the tab. Once it's closed, they can't delete their saved question themselves (staff can, and the purge will). | No accounts. A token that outlives the tab would need storage on the device or an account. | Optional saved delete link, or accounts. |
| **Names may be in saved gaps** (ADR 0005) | A saved question may still contain names or identifying details. Emails and phones are removed best-effort, and the parent edits a preview first. | Free-text anonymisation is unreliable, so we don't call it anonymous. Consent plus a visible, editable preview is the honest boundary. | Name detection that warns in the preview; staff-side redaction tools. |
| **Tombstones keep metadata** (ADR 0005) | After a parent or staff delete, the row keeps id, token hash, language, consent and date (no text) until the purge removes it. That isn't a hard 30-day ceiling: the purge is lazy (next save or staff list), and expiry uses the row's original `created_at`, not the delete time. | It stops a late or retried save from bringing a deleted question back. | A separate deleted-ids table with a shorter retention. |
| **Opt-in gap sample is biased** (ADR 0005) | The staff view only sees questions parents chose to share. | Privacy first. The ledger's numbers-only `abstained` count gives the overall rate. | Aggregate, text-free topic counts for every abstain. |
| **In-memory rate limits per instance** ([ADR 0006](docs/decisions/0006-railway-postgres-drizzle.md)) | Limits reset on deploy and aren't shared across replicas. | Single-instance prototype; no Redis to run. | Shared limits in Postgres or Redis. |
| **Staff passcode instead of real auth** ([ADR 0008](docs/decisions/0008-staff-passcode.md)) | One shared passcode with a signed 8-hour session. No per-person audit trail. Anyone with the code can read every saved question, and rotating the passcode doesn't end existing sessions. | Data is minimal and expires. Time went into the assistant. | SSO or magic links, roles and an audit log. |
| **Cost derived from the current catalog** ([ADR 0013](docs/decisions/0013-store-tokens-derive-cost.md)) | Reports price every past call at today's prices. | One fix corrects every estimate. The provider invoice stays the source of truth. | A dated catalog copy, for "cost at the time". |
| **Live transcription checks pending** ([ADR 0014](docs/decisions/0014-voice-transcription.md)) | `gpt-transcribe` was chosen from the provider docs and checked on two synthetic recordings only. Real voices, noisy rooms and Spanish quality aren't verified. The 2-minute cap cuts long memos, and if the provider stops reporting duration, transcription fails closed. | A live EN/ES check is paid and needs real recordings. Felipe confirms the model with it. | The live check with real EN/ES recordings; `gpt-4o-transcribe` as the fallback choice. |
| **No live-Postgres concurrency test** (ADR 0005, 0006) | The delete-vs-save race (tombstone upsert on the primary key; save `ON CONFLICT DO NOTHING`) is tested by SQL shape and an in-memory store, not by concurrent transactions on a running Postgres. | Tests must not need a database or network. The guarantee rests on documented Postgres primary-key semantics. | An integration test with concurrent transactions against a disposable Postgres (CI service container). |
| **Spanish name for 988** ([ARCHITECTURE § Open questions](docs/ARCHITECTURE.md#open-questions)) | The Spanish copy uses the English service name "988 Suicide & Crisis Lifeline". | Not yet checked against the official source; a wrong name in crisis copy is worse than the English one. | Verify the official Spanish name before launch. |
| **Clinician review pending** (ADR 0003, 0015) | Safety patterns, the fixed emergency and medical copy, what counts as a dose, and the notebook topics haven't been reviewed by a clinician. | Prototype for a take-home, with no clinical partner. | Clinician review before any real family uses Lumi. |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (pipeline diagram, failure modes, cost controls, privacy) and the [decision records](docs/decisions/).

In one line: **deterministic safety check (before any limit) → cheap router with fixed precedence → fixed copy for urgent, crisis and medical → buffered answer from the whole KB with citations → completion and citation-integrity checks → reveal → usage ledger**, in a single Next.js app with framework-free server logic.

## Running locally

Requirements: Node 24, pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # fill in values locally; never commit them
pnpm dev                     # http://localhost:3000 → redirects to /en or /es
```

| Script | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `format` | Biome |
| `pnpm typecheck` | `next typegen && tsc --noEmit` |
| `pnpm test` | Vitest (no network, no API calls) |
| `pnpm test:kb` | KB content gate and golden-set format only (its own CI job) |
| `pnpm smoke` | Small live run through the real pipeline (~14 cheap calls + 2 short transcriptions). **Costs money.** Needs `.env.local`. |
| `pnpm eval` | Golden-set evals against the real model. **Costs money.** Not in CI. |
| `pnpm db:generate` / `db:migrate` | Drizzle migrations (`drizzle/`). Migrate by hand against `DATABASE_URL`. |

Without `DATABASE_URL` the app still runs: the usage ledger is a no-op and saving a question says it isn't available in this demo. Without `STAFF_PASSCODE` and `STAFF_SESSION_SECRET` the staff area stays closed.

CI (`.github/workflows/ci.yml`) runs Biome, typecheck, tests (including the KB content gate) and a production build. No secrets.

## Evals

Plan and results: [docs/EVALS.md](docs/EVALS.md). _Results TODO._

## Cost

_TODO: measured cost per conversation (router included), cold vs warm, from the usage ledger and the eval run._ First data point, **historical** (one smoke run with the earlier model catalog, placeholder prices and notebook prompt v1, [PROCESS.md entry 4](docs/PROCESS.md); not re-run since): a practical question cost about $0.0008 cold and $0.0002 warm, router included, with the KB prefix ~99% cached from the second English answer on. The ledger stores token counts only; cost is derived from the price catalog when it's read ([ADR 0013](docs/decisions/0013-store-tokens-derive-cost.md)). Prompt caching is best-effort on the provider side, so we report what we measure rather than assume it. Controls are described in [ARCHITECTURE.md § Cost controls](docs/ARCHITECTURE.md#cost-controls).

## What I'd do next

_TODO._ Candidates: real staff auth and audit log, shared rate limiting, hybrid retrieval beyond ~200 articles, human review workflow for KB articles, more languages, accessibility audit with real users, a proper crisis-contacts policy per country.

## Process with AI

_Filled in as we go._ Running log: [docs/PROCESS.md](docs/PROCESS.md). Agent rules: [AGENTS.md](AGENTS.md).

## Docs index

- [BRIEF](docs/BRIEF.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [Decisions](docs/decisions/) · [DESIGN](docs/DESIGN.md) · [CONTENT-GUIDELINES](docs/CONTENT-GUIDELINES.md) · [EVALS](docs/EVALS.md) · [PROCESS](docs/PROCESS.md)

---

Lumi is fictional. Nothing here is medical advice. In an emergency, call 911. In emotional crisis, call or text 988.
