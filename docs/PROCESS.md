# Process log: building Lumi with AI agents

An honest record of what the agents did and what the human (Felipe) decided. Newest entries at the bottom.

## Roles

| Role | Who | Responsibility |
|---|---|---|
| Product owner / engineer | **Felipe Calderón** (human) | Picks the slice, approves architecture, owns tone and safety decisions, reviews and merges. |
| Orchestrator | Claude Opus 5.5 | Turns Felipe's decisions into phased briefs for the builder; coordinates review rounds. |
| Builder | Claude Opus 5.5 (Claude Code) | Implements each phase in this repo, runs checks, reports back. |
| Reviewer | GPT-6.1 Sol (Codex) | Independent review of each phase from a different model family. |

Using a different model family for review is deliberate: two models from the same family tend to share blind spots.

---

## Entry 1 — Phase 0: foundations (2026-10-30)

**Human decisions (before any code).** Working with the orchestrator, Felipe chose:

- The name **Lumi** and its bilingual identity ("A little light for the long nights" / "Una lucecita para las noches largas").
- The deep slice: a **bilingual Family Support Assistant** grounded only in a curated KB, plus a staff **gaps** view fed by consented unanswered questions. Donate, volunteer and about stay as placeholders.
- The pipeline shape (deterministic safety → cheap router → whole-KB answer with citations → validation → ledger) and the eight ADRs in `docs/decisions/`.
- Constraints: no accounts, no conversation storage, no paid API calls in Phase 0, no remote/push/deploy yet.

**What the builder agent did.**

- Checked current library APIs before writing any AI code: used the Context7 docs tool for the AI SDK (`generateText` + `Output.object`, `streamText`, `usage.inputTokenDetails.cacheReadTokens`) and Next.js 16 (`proxy.ts`, `PageProps`/`LayoutProps`, `next typegen`), and confirmed `gpt-6-luna` is a known model id in the installed `@ai-sdk/openai` types.
- Scaffolded the app by hand rather than with `create-next-app`, to avoid ESLint/template files we'd delete: Next.js 16.4, React 19.3, TypeScript 7 strict (+ `noUncheckedIndexedAccess`), Tailwind 4, Biome 2.6, Vitest 5, Zod 4, AI SDK 7, Drizzle.
- Wrote typed contracts and `NotImplementedError` stubs for every server module, with Zod schemas where they define a boundary (router output, KB frontmatter, gap submission, chat request, golden case). Planned behaviour is recorded as `it.todo` so the next phase starts from a test list.
- Built bilingual route shells, the design token theme and the Lumi mark. Computed WCAG contrast for every token pair with a script before committing to the palette.
- Wrote the docs: architecture, ADRs, content guidelines, evals plan, design, this log.

**Notable calls the builder made (flagged for Felipe).**

- Added a `rate-limit/` module and a `pipeline.ts` contract (not in the original module list) because config and ADR 0006 needed a home for them.
- Kept the abstain signal as an explicit marker (`[[NO_ANSWER]]`) as the first token, so abstention is detectable before the stream ends.
- Excluded Markdown from Biome: its Markdown formatter rewrote YAML examples inside code fences.
- Open questions are listed in `docs/ARCHITECTURE.md#open-questions` rather than decided silently.

**Checks.** `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (18 passing, 19 todo), `pnpm build` all pass. Smoke test with `next start`: `/` redirects by `Accept-Language`, `/es` renders with `lang="es"`, `/api/chat` returns 400 on bad input and 501 otherwise.

---

## Entry 2 — Codex review round 1 applied (2026-10-30)

**Where these changes came from.** After Phase 0, the orchestrator sent the repo to the reviewer (GPT-6.1 Sol via Codex) for **review round 1**. It returned 3 blockers, 8 should-fix items and 3 nice-to-haves. Felipe answered the five open questions from `ARCHITECTURE.md`, and the builder (Claude Opus 5.5) applied the findings to the docs, ADRs, contracts and tests. No model calls, no network.

**Felipe's decisions.**

- **Q1 Prices:** priced model catalog for the four comparison models. Luna and 6 Sol use Sep 2026 public reporting as placeholders; 6.1 Terra and 6.1 Sol are `null` until Felipe verifies them. Every entry has `source` and `verifiedAt`.
- **Q2 Scope:** US only, EN + ES families. 911 for emergencies, 988 for emotional crisis, "contact your local emergency services" outside the US (ADR 0012).
- **Q3 Self-harm:** the deterministic pre-check also catches explicit, imminent self-harm (backstop to the router).
- **Q4 Unvalidated text:** buffer → validate → reveal, with a calm progress state and measured latency (ADR 0010).
- **Q5 Transport:** NDJSON over fetch, specified in ARCHITECTURE.md § Transport.

**What was adopted, adapted or rejected.**

| # | Finding | Verdict | How / why |
|---|---|---|---|
| B1 | Unvalidated streamed text | Adopted | ADR 0010. `delta` events removed; one terminal `answer` event after checks; `progress` event for the wait. |
| B2 | Citation existence ≠ grounding | Adopted, extended | Renamed to citation integrity (`checkCitationIntegrity`) with an honest "guarantees / doesn't guarantee" note. Policy vs `<reference_data>` separation in the answer contract. Medical → fixed template (ADR 0011). The groundedness judge runs on **every** generated answer, not only a subset, plus `unsupported-claim` golden cases. |
| B3 | Emergency precedence | Adopted, adapted | Safety now runs before the length check and before rate limiting. Instead of a single `urgent` category, the router returns **all** intents and `resolveCategory()` applies the precedence in code, so the model can't get the order wrong. Mixed-intent cases in the golden set. |
| 4 | Gaps privacy | Adopted, adapted | No more "anonymous" claims. Editable preview + staff-access disclosure, topic label, 30-day retention. Delete path = staff delete + a one-time parent delete token (hash stored). Purge happens lazily on save/list instead of a scheduled job (one less moving part). ADR 0005 revised. |
| 5 | Staff auth | Adopted, adapted | HMAC session token, fail closed, throttled login, every request checked, `private, no-store`. Adapted: signed with a **separate `STAFF_SESSION_SECRET`** rather than a key derived from the passcode, so a captured cookie can't be used to brute-force a weak passcode offline. ADR 0008 revised. |
| 6 | Request context | Adopted | `RequestContext`, `stageSignal`, `isDeadline` (implemented + tested). `recordBestEffort` makes ledger writes never throw and never take longer than `ledgerWriteMs`. |
| 7 | Completion semantics | Adopted | `interpretCompletion` (implemented + tested): `length` → truncated, other non-`stop` → interrupted, marker detected on the full buffered text (split marker test), marker mid-answer → invalid. |
| 8 | Abuse controls | Adopted | `readBodyBounded` (byte cap before JSON parsing, tested with multi-byte text). `clientIpFromForwardedFor` takes the right-most XFF entry (Railway's edge appends it); to verify on first deploy. Separate limiters for chat / gaps / staff login, instance-wide model-call ceiling, key expiry + cap. |
| 9 | Usage contracts | Adopted | `ModelStep<T> = { result, call }` for router and answer, also on failure. Nullable token counts and cost in types and DB schema. `estimateCostUsd` returns `null` when anything is unknown (implemented + tested). Cost per conversation = sum by `requestId`, router included. |
| 10 | Model comparison | Adopted | ADR 0009 (proposed) + EVALS.md § Answer-model comparison: router fixed on Luna, frozen KB/prompt hash, Luna 3×, others 1×/3×, seven dimensions, budget guard ($2 default), unavailable ids skipped and reported, mocked failure tests listed as `it.todo`, human review of safety outputs. Unpriced models are skipped by the guard unless explicitly allowed. |
| 11 | CI | Adopted | `pnpm build` added to CI (it already builds with no env vars). KB tests in Part B run inside `pnpm test`, so they gate CI. Marking the check as *required* needs GitHub branch protection, which needs a remote: left for Felipe. |
| 12 | Accept-Language | Adopted | Highest q wins, `q=0` excluded, malformed weights ignored. Tests include `fr-FR,es;q=0.9` → es and `es;q=0,en;q=1` → en. |
| 13 | Qualify claims | Adopted | Caching described as best-effort and measured cold vs warm. "Nowhere else" replaced by "sent to OpenAI". Pre-submission processing notice on `/help`. "Live demo" slot in README. |
| 14 | Scope | Adopted | 12 article pairs instead of ~25 (Part B / entry 3). ADR 0002 and README updated. |

Nothing was rejected outright.

**Builder calls flagged for Felipe.**

- **Fixed safety copy moved to the UI dictionaries** (`safety.*`). `safety.emergencyMessage()` was removed from the server: the server only returns the event kind, and the UI renders reviewed copy that works even if the API is down. Dictionary tests check 911/988 placement, the outside-US line, no other numbers, and EN/ES key parity. **All of this copy needs Felipe's review.**
- **Shared content rules** (`src/server/content-rules.ts`): one list of banned patterns used by the dictionary tests, the KB tests and, later, the `noDosage` eval check.
- **Judge model = `gpt-6-sol`**, not Luna, to limit self-preference when Luna is the likely answer model. Sol is still a candidate arm, so its self-bias is a known caveat.
- **KB topics renamed** to match the 12 articles: `money-and-work`, `family-and-school`, `about-lumi` added; `daily-life` dropped.
- **`STAFF_SESSION_SECRET`** is a new env var. The builder didn't touch `.env.example` (rule: never open `.env*` files). Felipe needs to add the empty key.

**Checks.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, all passing (results in the commit).

---

## Entry 3 — Phase 1: the knowledge base (2026-10-30)

**Human decisions.** Felipe chose 12 complete article pairs over the ~25 first planned ("fewer, complete, high-quality; expand only if golden-set coverage shows gaps"), the suggested topic list, and that every high-risk article gets his personal review.

**What the builder agent did.**

- Wrote 12 EN and 12 ES articles in `content/kb/`. Spanish was written as Spanish, not translated line by line: same facts, steps and boundaries, but its own phrasing. One example: "a long stretch, not a sprint" became "una carrera de fondo, no de velocidad". Neutral Latin American vocabulary, "tú", "tu hijo o hija".
- Kept the suggested 12 topics. The only change is the ids and categories: `money-and-work`, `family-and-school` and `about-lumi` replace categories that no article used.
- Marked 5 articles `risk: high`: the 3 required (`questions-for-your-care-team`, `when-to-call-your-care-team`, `taking-care-of-yourself`) plus `talking-with-your-child` (what to tell a child about their illness is close to the clinical line) and `family-notebook` (it mentions the medicines list).
- Added `parseArticleFile` and `countWords` (no YAML dependency) and a KB content gate (`kb-content.test.ts`): schema, folder/filename match, unique ids, EN↔ES parity including category and risk, 250–450 words, shared banned patterns, 988 only inside the exact approved crisis line, no citation-like `[n]` or abstain marker in bodies, the medical-template article exists in both languages, required articles stay high-risk. It runs in `pnpm test` and in its own CI job (`pnpm test:kb`) so it can be a required check.
- Expanded `evals/golden.jsonl` to 40 cases across all 12 categories in EVALS.md. Tests check category coverage, that expected articles exist, that practical cases cover every article, and that borderline cases explain themselves.

**What the tests caught.** The first draft of the self-care article said "In a crisis, 988." in its "Who to ask" section. The 988 rule flagged it, because only the exact approved line may contain 988. It now refers to "the crisis line above".

**Content calls flagged for Felipe (please review).**

- The siblings article first said siblings "can't catch it". That's a medical claim, even if widely known, so it was replaced with "ask the care team how to answer that".
- `when-to-call-your-care-team` has **no symptom list**. It tells parents to get the list from their care team, keep it visible, call when in doubt, and call 911 in an emergency.
- `how-lumi-can-help` says plainly that Lumi is fictional and that the family team, volunteering and donations are placeholders. It repeats the processing disclosure (questions go to OpenAI) and the 30-day gap retention, so those two facts now live in content as well as config.
- Generic roles used: hospital social worker, financial counselor, child life specialist, school counselor, school nurse, employer HR, insurance plan member services. No organisations, names, numbers (except 911/988), laws or benefit amounts.
- Hedged claims that remain: "most hospitals can arrange an interpreter", "many hospitals have financial assistance programs", "some insurance plans cover rides", "some workers have legal protections". Felipe should confirm he's comfortable with these.

**Checks.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, all passing (results in the commit).
