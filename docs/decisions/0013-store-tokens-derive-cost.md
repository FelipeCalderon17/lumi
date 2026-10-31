# 0013 — Store tokens, derive cost

**Status:** Accepted · 2026-10-30 · *Felipe's design decision. Supersedes the `estimated_cost_usd` column in ADR 0006's ledger and the `estimatedCostUsd` field in the Phase 0 contracts.* · *Updated 2026-10-30 after Codex re-review 3: describes the SQL aggregation as built and the applied price catalog.*

## Context
The Phase 0 ledger stored an estimated USD cost on every row, computed from the price catalog at write time. Prices change: OpenAI cut GPT-6 prices by about 50% in September 2026. Every row written before a price change then carries a wrong cost, and nothing in the row says which prices were used, so it can't be corrected. When this was decided the catalog prices weren't verified yet, so every cost written then would have gone wrong as soon as they were. Felipe ran into the same problem at his job and fixed it the same way.

## Decision
- The `usage_ledger` stores **facts only**, one row per model step: `request_id`, `step` (`router | answer | transcribe | notebook | judge`), `model`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_tokens`, `audio_seconds` (transcription), `latency_ms`, `finish_reason`, `failure_reason`, `outcome`, `created_at`. **No cost column.** Unknown counts are `NULL`, never 0.
- Cost is **derived on read** from the priced catalog in `src/server/config.ts` (prices applied by Felipe on 2026-10-30, `verifiedAt` set). Each catalog entry has `billing` (`tokens` or `audio_duration`), its prices, a `source` and a `verifiedAt`. `estimateCost(row, catalog)` prices one row; `estimateGroupCost(group, catalog)` prices summed facts (same result: cost is linear in tokens).
- Unknown price or unknown usage → **`"unknown"`**, never `$0`. A group with any call of unknown usage is unknown, and a sum that includes an unknown is unknown (`addCosts`).
- **Aggregation, as built.** The staff view aggregates in SQL: `usageTotalsQuery` in `src/db/stores.ts` runs one `GROUP BY step, model` over every ledger row in the window (`SUM`s of the token and audio facts, `COUNT(*) FILTER` for calls with unknown usage, no row limit; `LIMIT` applies to groups only, and the summary says `complete: false` if it hits it). `summarizeTotals(totals, catalog)` then derives cost from those sums. The evals and smoke runs hold their rows in memory and use `summarizeUsage(rows, catalog)`, which is `summarizeTotals(totalsFromRows(rows))`: the same sums done in JS, then the same pricing, so the staff view and the reports can't disagree.
- `outputTokens` includes reasoning tokens (that's how OpenAI bills them). `reasoningTokens` is stored separately so we can see and tune how much thinking costs.

## Consequences
- Fixing a price in config corrects every past and future estimate at once. Comparing "before and after a price cut" is one catalog swap.
- Reports always use the current catalog. To report what something cost *at the time*, keep a dated copy of the catalog. We don't need that for a prototype.
- Reads do a little more work: one grouped SQL query, then a multiply per group. That's cheap at any volume we expect.
- The provider's invoice stays the source of truth. The ledger explains it per step.

## Alternatives
- **Store cost at write time** (the Phase 0 design). Rejected: goes stale on every price change and can't be corrected.
- **Store cost and the price version.** Workable, but more columns and a versioned catalog to keep forever, to answer a question we don't have.
- **Only read the provider's usage dashboard.** Rejected: no per-step or per-request breakdown, and nothing the evals can use.
