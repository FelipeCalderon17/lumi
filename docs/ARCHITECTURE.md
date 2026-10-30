# Architecture

One Next.js app (App Router) serves the pages and a single chat API route. All assistant logic lives in [`src/server/`](../src/server) as framework-free TypeScript ([ADR 0001](decisions/0001-single-nextjs-app.md)): no `next`, `react` or `src/app` imports, so it can be unit-tested directly and extracted later.

> **Status (Phase 0):** contracts and stubs only. Modules throw `NotImplementedError`; planned behaviour is listed as `it.todo` in each module's tests.

## Request flow

```
 Parent (browser, /en/help or /es/help)
   │  POST /api/chat  { message, locale }
   ▼
 src/app/api/chat/route.ts        thin adapter: parse → runPipeline → stream NDJSON ChatEvents
   │
   ▼
 src/server/pipeline.ts
   │
   ├─ 1. input check ──────────── Zod: 1..maxInputChars, locale ∈ {en, es}       ✗ → 400
   ├─ 2. rate-limit/ ──────────── in-memory fixed window per instance             ✗ → fallback(rate_limited)
   │
   ├─ 3. safety/  (NO AI) ─────── EN+ES keyword/regex emergency check             ✓ → emergency (fixed copy, 911 / hospital / care team)
   │                                                                                  └─ no model call, no cost
   ├─ 4. router/  (cheap model) ─ generateText + Output.object → { language, category }
   │        │                                                                     ✗ timeout/invalid → fallback
   │        ├─ emotional_crisis → crisis (fixed calm copy + human contacts)
   │        ├─ off_topic ───────→ off_topic (fixed short redirect)
   │        ├─ medical ─────────→ answer mode "medical_prep" (no advice; care team + questions to ask)
   │        └─ practical ───────→ answer mode "practical"
   │
   ├─ 5. knowledge/ ───────────── KB for router.language, handles [1]..[n] (loaded once, cached in memory)
   │
   ├─ 6. answer/  (model) ─────── streamText; system = rules + WHOLE KB (stable prefix → prompt cache)
   │        │                     must cite [n] or start with [[NO_ANSWER]]
   │        │                                                                     ✗ timeout/provider → fallback
   │        └─ delta, delta, …  → streamed to the UI
   │
   ├─ 7. validate/ ────────────── every [n] maps to a real handle?
   │        ├─ valid ─────────→ answer_done { citations }
   │        ├─ abstained ─────→ abstained (human contact + "save this question?")
   │        └─ invalid ───────→ fallback(invalid_output)
   │
   └─ 8. ledger/ ──────────────── per model call: tokens, cached tokens, est. cost, latency, outcome (no content)

 Separate, opt-in:  "Save this question so the team can write a guide?" [yes]
   POST /api/gaps { question, language, consent: true } → gaps/ → gap_question table
   Staff: /[locale]/staff/gaps (shared passcode, ADR 0008)
```

### Why this order

- **Safety first, without AI.** The emergency check is deterministic and runs on the raw text before anything can time out, fail, or be prompt-injected ([ADR 0003](decisions/0003-deterministic-safety-precheck.md)).
- **Router before answer.** A cheap classification call keeps the expensive call (whole KB in context) for questions that need it, and keeps medical and crisis messages on fixed, reviewed paths.
- **Validate after streaming.** Citations are checked against real handles before the answer is marked final. See [open question](#open-questions) on how invalid answers are shown.

## Failure modes

The UI never shows a blank screen or a raw error. Every failure becomes a `fallback` event with calm copy and human contacts. The emergency banner on `/help` is static HTML and does not depend on the API.

| Failure | Where | Detected by | What the parent sees |
|---|---|---|---|
| Emergency wording | safety | regex match | Fixed emergency steps (911, hospital emergency line, care team). No model call. |
| Message too long / empty | input | Zod | Inline message to shorten it. No model call. |
| Too many requests | rate-limit | counter | "Let's take a short pause" + human contacts. |
| Router slow (> `routerMs`) | router | `AbortSignal.timeout` | Fallback with human contacts. |
| Router output fails schema | router | `Output.object` / Zod | Fallback. |
| Provider down / 5xx / 429 | router, answer | AI SDK error after `maxRetries: 1` | Fallback. |
| No first token in `answerFirstTokenMs` | answer | timer | Fallback. |
| Stream exceeds `answerTotalMs` | answer | `AbortSignal.timeout` | Partial text is withdrawn → fallback. |
| Not in the KB | answer | `[[NO_ANSWER]]` marker | "I don't have that yet" + human contact + optional consent to save the question. |
| Cites a handle that doesn't exist / no citations | validate | handle check | Fallback (answer is not shown as grounded). |
| Prompt injection ("ignore your rules…") | router, answer | system rules + validate | Answer still has to cite the KB; uncited text fails validation. Covered by evals. |
| KB fails to load / invalid frontmatter | knowledge | Zod at startup | Build/test fails (articles are validated in CI), so it doesn't reach production. |
| Database down | gaps, ledger | driver error | Chat still works. Ledger write is best-effort; gap save shows "couldn't save, try later". |

Retries: **one layer only**, `config.retry.maxRetries` passed to the AI SDK. No retry loops of our own, since stacked retries multiply cost and latency.

## Cost controls

All numbers live in [`src/server/config.ts`](../src/server/config.ts).

- **Free paths first.** Emergency, input-too-long and rate-limited requests never reach a model.
- **Cheap router.** Small output cap (`maxRouterOutputTokens`) and a short timeout.
- **Prompt caching.** The answer prompt is `[static rules][whole KB][question]`. The first two parts are byte-identical across requests (handles sorted by id), so OpenAI's automatic prefix caching bills them at the cached rate after the first call. The ledger records `cacheReadTokens` so we can show this in practice instead of just claiming it.
- **Caps.** `maxInputChars`, `maxAnswerOutputTokens`, per-instance rate limit.
- **Ledger.** Each model call records tokens and estimated USD; `docs/EVALS.md` and the README will report cost per answer.
- **Evals are not in CI** (they cost money); they run on demand with `pnpm eval` ([ADR 0007](decisions/0007-evals.md)).

## Privacy

- **No accounts, no conversation storage** ([ADR 0005](decisions/0005-no-conversation-storage.md)). Messages live in the request and the browser tab, nowhere else.
- **Gaps are opt-in.** A question is saved only when the parent explicitly agrees, after the assistant couldn't answer. We save the question text, language and timestamp. No name, IP, user agent or conversation. Emails and phone numbers are stripped (best effort), and the UI asks parents not to include names.
- **Ledger is numbers only.** Token counts, model, latency and outcome enum. Never text.
- **Logs.** Never log message content; log request id, stage, outcome and the safety rule id.
- **Rate-limit keys** are hashed IPs held in memory and never persisted.
- **Third party.** Questions are sent to OpenAI for routing and answering. This is disclosed on the help page.

## Data model

Two tables ([`src/db/schema.ts`](../src/db/schema.ts)): `gap_question` and `usage_ledger`. See ADR 0006.

## Open questions

Tracked here until decided. Each decision becomes an ADR.

1. **Showing an answer that fails validation after streaming.** Options: (a) stream and replace with the fallback if validation fails, (b) buffer and reveal only when valid, (c) stream into a visually "drafting" state and confirm on `answer_done`. Leaning towards (c): it keeps the speed of streaming without presenting text as final before it's checked.
2. **Deterministic self-harm check.** Should `safety/` also match explicit self-harm phrases (defence in depth), or leave that to the router's `emotional_crisis`? The contract already allows `kind: "self_harm"`.
3. **Crisis contacts and country.** Content rules allow only the generic 911. A real crisis message would usually include a crisis line (988 in the US), and Spanish-speaking families outside the US use other emergency numbers. Lumi's assumed country decides this.
4. **Transport.** Plain NDJSON of `ChatEvent`s over `fetch` (simple, fully typed, no extra client library) vs. AI SDK UI message streams with `useChat`. Leaning towards NDJSON.
