# Lumi: a little light for the long nights

> *Una lucecita para las noches largas.*

A prototype website for **Lumi**, a fictional foundation supporting families of children with cancer, built for the FutureProofing take-home ([brief](docs/BRIEF.md)).

> **Status:** Phase 0, foundations. The repo, tooling, contracts and docs are in place. The assistant isn't wired up yet.

## What it is

A bilingual (English/Spanish) site where the one deep part is a **Family Support Assistant**: a parent can ask a practical question at any hour ("Can siblings visit on chemo days?", "¿Qué llevo para una noche en el hospital?") and get a short, warm answer **grounded only in a small library of guides written for families**, with every answer showing which guide it came from. When Lumi doesn't know, it says so and points to a person.

Behind it, a small **staff view** lists questions Lumi couldn't answer, saved only when a parent chooses to share them (no names), so the team knows which guide to write next.

Landing, donate and volunteer are placeholders.

## Why this slice

_TODO (fill in after Phase 2)._ Outline:

- Of the foundation's three goals (support families, raise funds, recruit volunteers), support is where AI can help most and harm most. That's where the judgement is.
- A stressed parent at 2 a.m. can't wait for office hours, doesn't want to search a PDF, and may be more comfortable in Spanish.
- A grounded, citing, abstaining assistant is useful on day one with ~25 articles, and the gaps view makes it improve where families actually need it.

## What I left out and why

_TODO._ Outline: accounts/login, conversation history, donations processing, volunteer sign-up flow, CMS for articles, vector search (ADR 0002), real staff auth (ADR 0008), medical content of any kind.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (pipeline diagram, failure modes, cost controls, privacy) and the [decision records](docs/decisions/).

In one line: **deterministic emergency check → cheap router → answer streamed from the whole KB (prompt-cached) with citations → citation validation → usage ledger**, in a single Next.js app with framework-free server logic.

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
| `pnpm eval` | Golden-set evals against the real model. **Costs money.** Not in CI. |

CI (`.github/workflows/ci.yml`) runs Biome, typecheck and tests. No secrets.

## Evals

Plan and results: [docs/EVALS.md](docs/EVALS.md). _Results TODO._

## Cost

_TODO: cost per answer from the usage ledger, cached-token share, cost of an eval run._ Controls are described in [ARCHITECTURE.md § Cost controls](docs/ARCHITECTURE.md#cost-controls).

## What I'd do next

_TODO._ Candidates: real staff auth and audit log, shared rate limiting, hybrid retrieval beyond ~200 articles, human review workflow for KB articles, more languages, accessibility audit with real users, a proper crisis-contacts policy per country.

## Process with AI

_Filled in as we go._ Running log: [docs/PROCESS.md](docs/PROCESS.md). Agent rules: [AGENTS.md](AGENTS.md).

## Docs index

- [BRIEF](docs/BRIEF.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [Decisions](docs/decisions/) · [DESIGN](docs/DESIGN.md) · [CONTENT-GUIDELINES](docs/CONTENT-GUIDELINES.md) · [EVALS](docs/EVALS.md) · [PROCESS](docs/PROCESS.md)

---

Lumi is fictional. Nothing here is medical advice. In an emergency, call 911.
