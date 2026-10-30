# Lumi: a little light for the long nights

> *Una lucecita para las noches largas.*

A prototype website for **Lumi**, a fictional foundation supporting families of children with cancer, built for the FutureProofing take-home ([brief](docs/BRIEF.md)).

> **Status:** Phase 2, server side. The assistant pipeline, voice-to-text, the notebook, gaps and staff endpoints work behind tests and a first live smoke test. The UI is next (Phase 3).
>
> **Live demo:** _TODO: Railway URL after Phase 3._

## What it is

A bilingual (English/Spanish) site for families in the US, where the one deep part is a **Family Support Assistant**: a parent can ask a practical question at any hour ("How do I talk with my other kids about this?", "¿Qué llevo para la primera noche en el hospital?") and get a short, warm answer **drawn only from a small library of guides written for families**, with every answer showing which guide it came from. Answers are checked before they're shown. When Lumi doesn't know, it says so and points to a person. Medical questions always go to the care team, with a fixed, reviewed message.

Behind it, a small **staff view** lists questions Lumi couldn't answer, saved only when a parent chooses to share them after seeing and editing exactly what will be stored. They're kept for 30 days, so the team knows which guide to write next.

Landing, donate and volunteer are placeholders.

## Why this slice

_TODO (fill in after Phase 2)._ Outline:

- Of the foundation's three goals (support families, raise funds, recruit volunteers), support is where AI can help most and harm most. That's where the judgement is.
- A stressed parent at 2 a.m. can't wait for office hours, doesn't want to search a PDF, and may be more comfortable in Spanish.
- A grounded, citing, abstaining assistant is useful on day one with 12 well-written guides, and the gaps view makes it grow where families actually need it.

## What I left out and why

_TODO._ Outline: accounts/login, conversation history, donations processing, volunteer sign-up flow, CMS for articles, vector search (ADR 0002), real staff auth (ADR 0008), medical content of any kind.

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

_TODO: measured cost per conversation (router included), cold vs warm, from the usage ledger and the eval run._ First data point (one smoke run, placeholder prices, [PROCESS.md entry 4](docs/PROCESS.md)): a practical question cost about $0.0008 cold and $0.0002 warm, router included, with the KB prefix ~99% cached from the second English answer on. The ledger stores token counts only; cost is derived from the price catalog when it's read ([ADR 0013](docs/decisions/0013-store-tokens-derive-cost.md)). Prompt caching is best-effort on the provider side, so we report what we measure rather than assume it. Controls are described in [ARCHITECTURE.md § Cost controls](docs/ARCHITECTURE.md#cost-controls).

## What I'd do next

_TODO._ Candidates: real staff auth and audit log, shared rate limiting, hybrid retrieval beyond ~200 articles, human review workflow for KB articles, more languages, accessibility audit with real users, a proper crisis-contacts policy per country.

## Process with AI

_Filled in as we go._ Running log: [docs/PROCESS.md](docs/PROCESS.md). Agent rules: [AGENTS.md](AGENTS.md).

## Docs index

- [BRIEF](docs/BRIEF.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [Decisions](docs/decisions/) · [DESIGN](docs/DESIGN.md) · [CONTENT-GUIDELINES](docs/CONTENT-GUIDELINES.md) · [EVALS](docs/EVALS.md) · [PROCESS](docs/PROCESS.md)

---

Lumi is fictional. Nothing here is medical advice. In an emergency, call 911. In emotional crisis, call or text 988.
