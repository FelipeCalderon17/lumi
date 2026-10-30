# 0001 — One Next.js app; framework-free logic in `src/server`

**Status:** Accepted · 2026-10-30

## Context
The prototype needs a handful of pages and one streaming chat endpoint (plus a small gaps endpoint). It's built by one person in days and reviewed by people who penalise over-abstraction.

## Decision
A single Next.js App Router app serves pages and API routes. Route handlers stay thin: parse, call `src/server`, serialise. All assistant logic (`safety`, `router`, `knowledge`, `answer`, `validate`, `gaps`, `ledger`, `rate-limit`, `config`) lives in `src/server/` as plain TypeScript that doesn't import `next`, `react` or `src/app`.

## Consequences
- One deploy, one repo, one set of tooling.
- Server logic is unit-tested without a framework and could move to a separate service by swapping the route adapter.
- The boundary has to be kept by convention (AGENTS.md); it can be enforced later with a lint rule.

## Alternatives
- **Separate Express/Fastify backend.** Rejected: two deploys, CORS and duplicated types for no benefit at this size.
- **Server Actions for chat.** Rejected for the chat stream: a plain `Request → Response` handler is easier to stream, test and reason about.
