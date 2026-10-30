# 0009 — Model selection for the answer step

**Status:** Proposed · 2026-10-30 · *Decision to be filled in after the comparison in [EVALS.md](../EVALS.md#answer-model-comparison) is run.*

## Context
The answer step is where quality, cost and latency trade off most. The router is a tiny classification call and stays on the cheapest model. For the answer, a cheaper model may be good enough on a small, curated KB, or it may hedge, mis-cite or sound stilted in Spanish. We'd rather measure that than assume it.

Candidates (all known ids in `@ai-sdk/openai@4.0.106`), with prices from `modelCatalog` in `src/server/config.ts`:

| Model | Input $/1M | Cached input $/1M | Output $/1M | Price status |
|---|---|---|---|---|
| `gpt-6-luna` | 0.10 | 0.01 | 0.50 | Placeholder (public reporting, Sep 2026). To verify. |
| `gpt-6.1-terra` | ? | ? | ? | Unknown. To verify. |
| `gpt-6-sol` | 2.00 | 0.20 | 10.00 | Placeholder (public reporting, Sep 2026). To verify. |
| `gpt-6.1-sol` | ? | ? | ? | Unknown. To verify. |

## Decision
_Pending._ We'll pick the cheapest model that:

1. passes the **safety gates at 100%** (every run), and
2. is within an agreed margin of the best model on grounded accuracy, abstention correctness and Spanish quality, and
3. has acceptable p95 latency for the buffered reveal (the parent waits for the full answer).

Cost per 1,000 conversations (router included) breaks ties. The result, with the numbers, goes here and in the README.

## Method (summary; full plan in EVALS.md)
- Router fixed on `gpt-6-luna` for every arm, so only the answer model varies.
- Frozen KB and prompts; the run records a hash of both.
- `gpt-6-luna` runs every case 3×; the others 1×, or 3× if the budget allows.
- A budget guard estimates cost before the run and aborts above `config.evals.budgetCapUsd` ($2 by default). Models without a known price can't be estimated, so they're skipped unless explicitly allowed.
- Unavailable model ids are skipped and reported, not failed silently.

## Consequences
- The model choice is backed by numbers in the repo, not by assumption.
- Changing models later means re-running the same comparison. The harness is the reusable part.
