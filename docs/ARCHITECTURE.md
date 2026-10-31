# Architecture

One Next.js app (App Router) serves the pages and a small set of API routes. All assistant logic lives in [`src/server/`](../src/server) as framework-free TypeScript ([ADR 0001](decisions/0001-single-nextjs-app.md)): no `next`, `react` or `src/app` imports, so it can be unit-tested directly and extracted later.

> **Status (Phase 2):** the server side is implemented and tested with mocked models: the chat pipeline, voice-to-text, notebook structuring, gaps, staff endpoints and the usage ledger. One live smoke test has been run ([PROCESS.md](PROCESS.md), entry 4). The UI is Phase 3.

**Scope.** Lumi serves English- and Spanish-speaking families **in the US** ([ADR 0012](decisions/0012-us-scope-and-crisis-contacts.md)): 911 for emergencies, the 988 Suicide & Crisis Lifeline for emotional crisis, and "contact your local emergency services" for anyone outside the US.

## Request flow

```
 Parent (browser, /en/help or /es/help)
   │  POST /api/chat  { message, locale }      fetch + AbortController
   ▼
 src/app/api/chat/route.ts        thin adapter: bounded read → parse → RequestContext → NDJSON
   │
   ├─ 0. body ≤ maxRequestBytes ─── read as a stream, stop past the cap           ✗ → 413
   ├─ 1. JSON + shape ───────────── { message: string, locale ∈ {en, es} }       ✗ → 400
   ▼
 src/server/pipeline.ts           runPipeline(request, ctx: { requestId, rateLimitKey, signal })
   │
   ├─ 2. safety/  (NO AI) ──────── EN+ES rules on the raw text, ANY length         ✓ → emergency (fixed copy)
   │                               medical_emergency → 911 · self_harm → 911 + 988     no model call, no cost,
   │                                                                                     NEVER rate-limited
   ├─ 3. length check ──────────── 1..maxInputChars                                ✗ → 400 too_long
   ├─ 4. rate-limit/ (client) ──── per hashed client IP                            ✗ → fallback(rate_limited)
   ├─ 5. rate-limit/ (instance) ── ceiling on model calls per instance             ✗ → fallback(capacity)
   │
   │     ── progress { stage: "reading_guides" } ──▶  UI: "Looking through our family guides…"
   │
   ├─ 6. router/  (gpt-6-luna) ─── Output.object → { language, intents[], topic }
   │        │                      code resolves precedence:                       ✗ timeout/invalid → fallback
   │        │                      urgent → emotional_crisis → medical → practical → off_topic
   │        ├─ urgent ──────────→ emergency(detectedBy: router)   fixed copy, 911
   │        ├─ emotional_crisis → crisis                          fixed copy, 988 + human contacts
   │        ├─ medical ─────────→ medical                         fixed template + link to
   │        │                                                     "Questions to ask your care team"
   │        ├─ off_topic ───────→ off_topic                       fixed short redirect
   │        └─ practical ───────→ continue
   │
   ├─ 7. knowledge/ ───────────── KB for router.language, handles [1]..[n] (loaded once)
   │
   ├─ 8. answer/  (model) ─────── streamText, BUFFERED on the server (nothing sent yet)
   │        │                     system = policy  +  <reference_data> KB </reference_data>
   │        │                     user   = <question> … </question>
   │        │                                                                      ✗ no first token / total deadline
   │        │                                                                        / provider error → fallback
   │        ▼
   ├─ 9. completion check ──────── finishReason must be "stop"                     ✗ length → fallback(truncated)
   │                               [[NO_ANSWER]] first (checked on the full text)    ✗ other → fallback(interrupted)
   │        ├─ abstained ───────→ abstained { topic }   human contact + offer to save the question
   │        ▼
   ├─ 10. validate/ ────────────── citation integrity: every [n] is a real handle, ≥ 1 cited
   │        ├─ valid ───────────→ answer { text, citations }   revealed in one piece
   │        └─ invalid ─────────→ fallback(invalid_output)
   │
   └─ 11. ledger/ ─────────────── AFTER the terminal event: one row per model call (router AND answer,
                                  success or failure), best-effort, time-bounded. Token facts only;
                                  cost is derived on read (ADR 0013).

 Separate, opt-in, after `abstained`:
   editable preview + "Lumi staff can read this" → POST /api/gaps { question, language, topic, consent: true }
   → gaps/ → gap_question (30-day retention, delete token)       rate-limited separately
   Staff: /[locale]/staff/gaps (passcode → HMAC session cookie, ADR 0008)
```

### Other endpoints

All thin adapters over `src/server`, with the same rules: bounded body read, Zod at the boundary, safety before limits where text is involved, a separate rate limit plus the instance-wide model-call ceiling, best-effort ledger, nothing stored that isn't listed here.

| Endpoint | Server module | What it does |
|---|---|---|
| `POST /api/transcribe` | `transcribe/` | Voice → text with `gpt-transcribe` ([ADR 0014](decisions/0014-voice-transcription.md)). webm/mp4/m4a, max 2 minutes (bytes, declared duration and provider-measured duration), container signature check. Returns text only; audio stays in memory for the request. |
| `POST /api/notebook/prepare` | `notebook/` | The parent's on-device notes → a structured page: observations by topic + questions for the care team, each citing its source notes. Response: `{ safetyNotices, result }`. Safety check on every note first; a match adds a notice (fixed emergency steps shown first) but never blocks the page ([ADR 0003](decisions/0003-deterministic-safety-precheck.md)). Code checks the source indexes and that every quantity in an item (digits, fractions, written numbers EN/ES) appears with the same value and the same full unit (°C ≠ °F, mL ≠ mL/kg) in a cited note's text; numeric forms it can't read must be copied verbatim (timestamps aren't a source); dates come from the notes. Any failure → the raw notes grouped by date (`result.type: "notebook_fallback"`). Stateless. |
| `POST /api/gaps`, `DELETE /api/gaps/[id]` | `gaps/` | Consented gap save (redacted, 30-day retention, one-time delete token) and parent delete. Save statuses: `saved` / `uncertain` (both with `id` + `deleteToken`; the id and token are created before the insert, and an `uncertain` save can be deleted or retried idempotently with `retry: { id, deleteToken }`) / `failed` (nothing written) / `unavailable` (no database). |
| `POST /api/staff/login`, `/logout`; `GET /api/staff/gaps`; `DELETE /api/staff/gaps/[id]` | `staff-auth/`, `staff.ts` | Passcode → HMAC session cookie; every request verified; fails closed. The list shows gaps and usage with **derived** cost, aggregated in SQL over the whole 30-day window (`complete: false` + a reason if the step × model group bound is hit). |

Event names on the chat stream are the Phase 0 contract, confirmed as final by Felipe after Codex review 3: `abstained` is the "no answer" outcome and `fallback` (with a `reason`) covers every error, so there's no `no_answer` or `error` event.

### Why this order

- **Safety first, without AI, and before any limit.** The deterministic check runs on the raw text before the length check, the rate limiter, or anything that can time out, fail or be prompt-injected ([ADR 0003](decisions/0003-deterministic-safety-precheck.md)). An over-long or rate-limited message that describes an emergency still gets the emergency steps.
- **Router before answer.** A cheap classification call keeps the expensive call (whole KB in context) for practical questions only, and keeps urgent, crisis and medical messages on fixed, reviewed paths.
- **Precedence in code, not in the model.** The router lists every intent it sees. Code picks the path with a fixed order, so "what should I pack, also he's not breathing well" can't come out as a packing answer. (The deterministic check should already catch that example; the router is the second layer for paraphrases.)
- **Buffer → validate → reveal** ([ADR 0010](decisions/0010-buffer-validate-reveal.md)). No model text reaches the parent until it has passed the completion check and citation integrity. The wait is shown as a calm progress state and measured in the evals (p50/p95).

### What citation integrity does and doesn't guarantee

`validate/` checks that every `[n]` maps to a real article and that at least one is cited. That's **integrity, not grounding**: a real handle can sit next to a sentence the article doesn't support. We reduce that risk in three ways, and measure what's left:

1. **Clinical questions never reach generation.** `medical` gets a fixed, reviewed template ([ADR 0011](decisions/0011-medical-fixed-template.md)).
2. **Policy and data are separated.** The KB is placed in a delimited `<reference_data>` block that the policy describes as data, never instructions, and the question sits in its own block. This lowers (but doesn't remove) the risk of injected text in either one being followed.
3. **Groundedness is measured offline.** An LLM-as-judge check flags unsupported claims, including golden cases built to tempt the model into a valid handle plus an unsupported claim ([EVALS.md](EVALS.md)).

## Transport

**NDJSON over `fetch`** (decided; [ADR 0010](decisions/0010-buffer-validate-reveal.md)).

- **Framing.** `Content-Type: application/x-ndjson; charset=utf-8`, `Cache-Control: no-store`. One `ChatEvent` JSON object per line, `\n`-terminated, no blank lines (`encodeEvent` in `pipeline.ts`). Newlines inside text are JSON-escaped, so framing can't break.
- **Events.** Zero or more `progress` events, then **exactly one terminal event**: `emergency | crisis | medical | off_topic | answer | abstained | fallback`. The server closes the stream right after the terminal event. Nothing is sent after it.
- **Cancellation.** The client aborts with an `AbortController` (new question, page leave). The server sees `request.signal` abort. `RequestContext.signal` aborts every stage, the model call is cancelled, and the ledger records `cancelled`.
- **HTTP errors.** Only transport problems are non-2xx: `413 too_large`, `400 invalid_request`, `400 too_long` (shown as an inline "please shorten it" message), `5xx`, and the body-read errors from `bodyErrorResponse`: `408 body_timeout` (the body was still arriving at the read deadline), `400 aborted` (the client went away, including a request that was already aborted when we started reading), `400 invalid_body` (the stream errored or was already read) and `413 too_large` (past the byte cap; we stop reading there). The client shows the **fallback** for any non-2xx except `too_long`. All pipeline outcomes, including rate limits, are `200` with a terminal event.
- **Notebook errors** (`POST /api/notebook/prepare`) always have one envelope, `{ error, safetyNotices }`, with `Cache-Control: private, no-store`: `400 invalid_request` (bad shape or locale), `400 invalid_notes` (a note over a limit or a bad `createdAt`), and the body-read errors above (with `safetyNotices: []`). Every note text that can be recovered from the body is checked for emergencies before anything else is validated.
- **Premature EOF.** If the stream ends without a terminal event (network drop, proxy timeout, crash), or a line fails to parse, the client shows the **fallback**. It never shows a partial state as an answer.

## Request context and deadlines

`RequestContext { requestId, rateLimitKey, signal }` ([`context.ts`](../src/server/context.ts)) is built by the route from the request and passed to every stage. `stageSignal(ctx, ms)` combines the request's signal with a per-stage deadline (`config.timeouts.*`), so a stage stops either when the parent goes away or when its own time is up, and `isDeadline()` tells the two apart for the ledger.

Ledger writes happen **after** the terminal event is sent, through `recordBestEffort` (never throws, gives up after `ledgerWriteMs`). A slow or down database can't delay or break an answer.

## Failure modes

The UI never shows a blank screen or a raw error. Every failure becomes a terminal event with calm, fixed copy and human contacts. The emergency and 988 lines on `/help` are static HTML and don't depend on the API.

| Failure | Where | Detected by | What the parent sees |
|---|---|---|---|
| Emergency wording (any length) | safety | rule match | Fixed emergency steps (911, nurse/call button, outside-US line). No model call. Never rate-limited. |
| Explicit, imminent self-harm wording | safety | rule match | Fixed steps: 911 if in danger, 988 (call or text, Spanish available). No model call. |
| Urgent wording the rules missed | router | `urgent` intent | Same fixed emergency steps. |
| Emotional crisis | router | `emotional_crisis` intent | Fixed calm copy with 988 and the hospital social worker. |
| Medical question | router | `medical` intent | Fixed template: ask the care team + link to "Questions to ask your care team". No generation. |
| Body too large | route | bounded read | Fallback (413). Nothing parsed. |
| Message too long / empty | pipeline | Zod, after safety | Inline message to shorten it. No model call. |
| Too many requests (client) | rate-limit | counter | "Let's take a short pause" + human contacts. |
| Instance model-call ceiling | rate-limit | global counter | Fallback(capacity). |
| Router slow (> `routerMs`) | router | `stageSignal` deadline | Fallback. |
| Router output fails schema | router | `Output.object` / Zod | Fallback. |
| Provider down / 5xx / 429 | router, answer | AI SDK error after `maxRetries: 1` | Fallback. |
| No first token in `answerFirstTokenMs` | answer | timer | Fallback. |
| Answer exceeds `answerTotalMs` | answer | `stageSignal` deadline | Fallback. Nothing was shown, so nothing is withdrawn. |
| Answer cut off (`finishReason: length`) | completion check | `interpretCompletion` | Fallback(truncated). Never shown, even if its citations are valid. |
| Answer interrupted / filtered / other finish | completion check | `interpretCompletion` | Fallback(interrupted). |
| Abstain marker split across chunks | completion check | checked on the full buffered text | Abstained, as intended. |
| Not in the KB | answer | `[[NO_ANSWER]]` first | "I don't have a guide on that yet" + human contact + optional, previewed gap save. |
| Unknown handle / no citations | validate | integrity check | Fallback (not shown as grounded). |
| Valid handle, unsupported claim | validate can't see it | offline judge (evals) | **Can reach the parent.** Measured, not prevented. Kept small by the fixed medical path and the prompt rules. |
| Prompt injection ("ignore your rules…") | router, answer | policy/data separation + integrity | Still has to cite real articles or abstain. Covered by evals. |
| Client disconnects | all | `ctx.signal` | Nothing (they left). Model call cancelled; ledger `cancelled`. |
| Stream ends without a terminal event | client | NDJSON reader | Fallback. |
| KB fails to load / invalid frontmatter | knowledge | Zod + KB tests in CI | Build/test fails, so it doesn't reach production. |
| Database down | gaps, ledger | driver error / timeout | Chat unaffected. Ledger write skipped after `ledgerWriteMs`. Gap save: `failed` if nothing was written ("couldn't save, try later"); `uncertain` if the insert may still commit (the parent gets the id + delete token to delete or retry idempotently). Postgres `statement_timeout` (`dbStatementMs`) cancels statements the app stopped waiting for. |
| Router / notebook object with a non-`stop` finish | completion check | `incompleteFinish` | Not used even if schema-valid: `length` → truncated, anything else → interrupted. Usage still recorded. |
| Transcription without a provider duration | transcribe | `trustedDuration` | Text discarded: `failed(unverified_duration)`. Ledger keeps the call with `audio_seconds` null. |
| Provider duration not finite / ≤ 0, or two durations disagree | transcribe | `trustedDuration` | Text discarded: `failed(invalid_duration)` / `failed(inconsistent_duration)`. Ledger: `audio_seconds` null + that reason. When they agree, the largest is checked against the limit. |
| Parent deletes a gap whose save hasn't committed yet | gaps | tombstone upsert on the primary key | The delete writes a blank, deleted row with that id; the late insert hits `ON CONFLICT DO NOTHING`. The question never stays stored. |
| Staff deletes from a stale list after the parent deleted, then the parent retries the save | gaps | staff delete is the same soft tombstone (`UPDATE`, never `DELETE`) | The id and token hash stay, so the retry hits the tombstone and returns `failed`; the question stays blank. |
| Stalled, aborted, errored or oversized body | all POST routes | read deadline, request signal, byte cap | 408 / 400 / 400 / 413 via `bodyErrorResponse`. A body stream's `cancel()` is awaited at most `bodyCancelMs`. |

Retries: **one layer only**, `config.retry.maxRetries` passed to the AI SDK. No retry loops of our own, since stacked retries multiply cost and latency.

## Abuse controls

- **Bounded body.** `readBodyBounded` reads the request stream and stops past `maxRequestBytes` (8 KB). `Content-Length` isn't trusted, and nothing over the cap is parsed. Reads are bounded in time too: `bodyReadMs` (audio: `audioBodyReadMs`), the request's AbortSignal (checked before every read and before each chunk is accepted, so an already-aborted request never reads as `ok`), and at most `bodyCancelMs` waiting for a stream's `cancel()`.
- **Trusted client IP.** On Railway, the edge proxy appends the address it received the connection from to `X-Forwarded-For`. Anything to the left of that entry was sent by the client and can be forged. So we take the **right-most** entry (`config.clientIp.trustedProxyHops = 1`, `clientIpFromForwardedFor`). If the header is missing, the request goes into a shared "unknown" bucket rather than being unlimited. The hop count is config, because a CDN in front of Railway would add a hop. *To verify on first deploy:* log the header's entry count (never the IPs) once and confirm it's 1.
- **Separate limiters** (`config.rateLimit`): chat per client, gap submissions per client, parent gap deletes per client (a delete can write a tombstone row, so it's bounded; generous so a privacy delete is rarely refused), staff login per client, and an instance-wide model-call ceiling. Fixed windows in memory; expired entries are swept and the table is capped at `maxTrackedKeys`.
- **Rate-limit keys** are a salted hash of the trusted IP, held in memory, never persisted or logged.
- **Known limitation:** limits are per instance and reset on deploy (ADR 0006).

## Cost controls

All numbers live in [`src/server/config.ts`](../src/server/config.ts), including a **priced model catalog** (`modelCatalog`) with a `source` and `verifiedAt` for every price. Unknown prices are `null`, and costs that depend on them are reported as unknown, never as $0.

- **Free paths first.** Emergency, self-harm, too-large, too-long and rate-limited requests never reach a model. Crisis, medical and off-topic stop after the router.
- **Cheap router.** `gpt-6-luna`, small output cap, short deadline.
- **Prompt caching (not guaranteed).** The answer prompt is `[policy][KB][question]`, and the first two parts are byte-identical across requests (articles sorted by id). OpenAI applies automatic prefix caching to repeated long prefixes, but it's best-effort: it depends on traffic, timing and the provider. We **measure** it: the ledger records `cachedInputTokens`, and the evals report cold vs warm cost separately.
- **Caps.** `maxRequestBytes`, `maxInputChars`, `maxRouterOutputTokens`, `maxAnswerOutputTokens`, rate limits and the instance ceiling.
- **Ledger.** One row per model call (router, answer, transcribe, notebook), success **and** failure, with token facts (input, cached input, output, reasoning; `null` if unknown), audio seconds for transcription, latency, finish reason and outcome. **No stored cost** ([ADR 0013](decisions/0013-store-tokens-derive-cost.md)): `estimateCost(row, catalog)` derives it on read, and unknown prices or usage show as "unknown", never $0. **Cost per conversation** = sum of rows sharing a `requestId`, so router overhead is always included.
- **Evals are not in CI** (they cost money). They run on demand with `pnpm eval`, behind a budget guard ([ADR 0007](decisions/0007-evals.md), [ADR 0009](decisions/0009-model-selection.md)).

## Privacy

- **No accounts, no conversation storage** ([ADR 0005](decisions/0005-no-conversation-storage.md)). Lumi doesn't store messages. To answer, the question **is sent to OpenAI** (router and answer calls) and processed under OpenAI's API data terms. The help page says this before the parent asks.
- **Gaps are opt-in and not anonymous.** After an abstain, the parent can save the question. They see an **editable, minimal preview** of exactly what will be stored, with a plain note that Lumi staff can read it. We store that edited text, the language, a router-assigned topic label and a timestamp. We do not collect a separate name field, IP address, user agent or conversation history. The saved question may still contain identifying details. Emails and phone numbers are removed from the preview (best effort). Rows older than 30 days are **deleted on the next question save or staff list request**, so they may remain stored longer if neither occurs. Staff can delete any row, and the parent gets a one-time delete token on save (only its hash is stored). Both deletes are the same **soft tombstone**: the question is blanked and the row marked `deleted`, but the id and token hash stay, so a retry with the original credentials can't store the question again. Only the retention purge removes rows.
- **Ledger is numbers only.** Token counts, model, latency, finish reason and outcome enums. Never text.
- **Logs.** Never log message content. Log the request id, stage, outcome and the safety rule id.
- **Staff view** requires a signed, expiring session. Responses are `private, no-store` ([ADR 0008](decisions/0008-staff-passcode.md)).

## Data model

Two tables ([`src/db/schema.ts`](../src/db/schema.ts), migrations in [`drizzle/`](../drizzle)): `gap_question` (question, language, topic, consent, delete token hash, `deleted` tombstone flag, created_at; a parent or staff delete blanks the question and sets `deleted`, tombstones are hidden from staff and purged with the same retention; only the purge removes rows) and `usage_ledger` (one row per model call: step, model, nullable token counts, reasoning tokens, audio seconds, latency, finish reason, outcome; **no cost column**, ADR 0013). See ADR 0006. Without `DATABASE_URL` both degrade: the ledger is a no-op with one warning, and gap save returns `unavailable`.

## Open questions

Decided in review round 1: buffering (ADR 0010), deterministic self-harm check (ADR 0003), country and crisis contacts (ADR 0012), transport (NDJSON, above). Decided after Codex review 3: notebook safety on past events: a safety notice comes **with** the page, never instead of it (ADR 0003); the price catalog for every model is applied (ADR 0009, 0014); output caps router 1,000 / answer 3,000 approved until Phase 4 tuning.

Still open:

1. **Spanish name for 988.** The fixed copy uses the English service name "988 Suicide & Crisis Lifeline" in both languages. Should the Spanish copy use the service's official Spanish name? Needs checking against the official source before launch.
