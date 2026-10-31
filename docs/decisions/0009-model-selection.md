# 0009 — Model selection for the answer step

**Status:** Proposed — recommendation from the Phase 4 run, pending Felipe's sign-off · 2026-10-31 · *First written 2026-10-30; Decision filled in from the comparison in [EVALS.md § Results](../EVALS.md#results).*

## Context
The answer step is where quality, cost and latency trade off most. The router is a tiny classification call and stays on the cheapest model. For the answer, a cheaper model may be good enough on a small, curated KB, or it may hedge, mis-cite or sound stilted in Spanish. We'd rather measure that than assume it.

Candidates (all known ids in `@ai-sdk/openai@4.0.106`), with prices from `modelCatalog` in `src/server/config.ts`:

| Model | Input $/1M | Cached input $/1M | Output $/1M |
|---|---|---|---|
| `gpt-6-luna` | 0.10 | 0.01 | 0.50 |
| `gpt-6.1-terra` | 1.00 | 0.05 | 5.00 |
| `gpt-6-sol` | 2.00 | 0.20 | 10.00 |
| `gpt-6.1-sol` | 2.00 | 0.10 | 10.00 |

Source: OpenAI launch pages + public pricing trackers, applied by Felipe on 2026-10-30 (`verifiedAt` in the catalog). The provider's invoice remains the truth; because cost is derived on read (ADR 0013), a later correction fixes every past estimate.

Output caps (router 1,000, answer 3,000 tokens, reasoning included) are approved by Felipe for now; the Phase 4 measurements are in the Decision below.

## Decision
**Recommendation: keep `gpt-6-luna` for the answer step.** `config.models.answer` is unchanged.

**The rule** (thresholds set by the orchestrator before the run): pick the cheapest model that
1. passes the **safety gates at 100%** in every run;
2. is within **5 percentage points** of the best model on grounded accuracy and on abstention correctness, and within **0.2** (1–3 scale) of the best on Spanish quality;
3. has a total p95 latency of **≤ 15 s** (the parent waits for the whole buffered answer).

Cost per 1,000 conversations (router included) breaks ties.

**Measured** (2026-10-31; KB `b7c33acfe8fb` / `d0026b3a7465`, prompts `d2034d73e97b`; router fixed on `gpt-6-luna`; judge `gpt-6-sol`; Luna 3× on all 72 cases, the others 1× on the 42 answer-step cases):

| | `gpt-6-luna` | `gpt-6.1-terra` | `gpt-6.1-sol` | `gpt-6-sol` |
|---|---|---|---|---|
| 1. Safety gates | **100%** (102/102) | **100%** (6/6) | **100%** (6/6) | **100%** (6/6) |
| 2a. Grounded accuracy (best 95.8%) | 93.1% (−2.7 pt) ✓ | **95.8%** ✓ | 87.5% (−8.3 pt) ✗ | 91.7% (−4.1 pt) ✓ |
| 2b. Abstention correctness (best 100%) | 98.2% (−1.8 pt) ✓ | **100%** ✓ | 97.3% (−2.7 pt) ✓ | **100%** ✓ |
| 2c. Spanish quality (best 3.00) | 2.97 (−0.03) ✓ | **3.00** ✓ | **3.00** ✓ | **3.00** ✓ |
| 3. Total p95 latency | 6.50 s ✓ | 6.42 s ✓ | 6.73 s ✓ | 6.37 s ✓ |
| Eligible | **yes** | yes | no (2a) | yes |
| Per 1,000 answered conversations, warm / cold | **$0.22** / $0.80 | $1.15 / $7.07 | $2.27 / $14.47 | $3.07 / $14.64 |

Three models are eligible: `gpt-6-luna`, `gpt-6.1-terra` and `gpt-6-sol`. `gpt-6-luna` is the cheapest of them, about 5× cheaper than `gpt-6.1-terra` warm and about 9× cheaper cold. It also had the most evidence (3 runs of every case). The judge found no unsupported claim in any of its 102 generated answers, its boundary score was 3.00, and its p50 latency was the lowest (3.45 s).

**What this doesn't show.**
- The margins are small next to the sample. The other arms ran once over 24 practical runs, where one case is ~4 points. `gpt-6.1-sol` falls outside the margin by 2 cases.
- Luna's weakest spot is abstention on one question ("Can our dog visit?": answered in 2 of 3 runs, though grounded per the judge; EVALS.md § Problems found).
- The safety categories end before the answer model. So "100%" for the other arms covers their injection and mixed-intent runs; the router's safety behaviour is shared and was measured 3× on Luna.
- The judge is `gpt-6-sol`, which is also an arm.

Two more runs of each other arm (~$1.40 at the measured cost, judge included) would firm this up.

**Output caps.** No truncation in any arm. The measured maxima, reasoning included, were: answer 577 of 3,000 (Luna; reasoning max 501), router 188 of 1,000, notebook 266 of 4,000. The caps stay as approved. Lowering them to router 500 / answer 1,500 / notebook 1,000 would still leave ≥ 2.6× headroom; that's a recommendation for Felipe, not applied.

## Method (summary; full plan in EVALS.md)
- Router fixed on `gpt-6-luna` for every arm, so only the answer model varies.
- Frozen KB and prompts; the run records a hash of both.
- `gpt-6-luna` runs every case 3×; the others 1×, on the cases that can reach the answer step.
- A budget guard estimates cost before the run and aborts above `config.evals.budgetCapUsd` ($2 by default). Models without a known price can't be estimated, so they're skipped unless explicitly allowed.
- Unavailable model ids are skipped and reported, not failed silently.

## Consequences
- The model choice is backed by numbers in the repo, not by assumption.
- Changing models later means re-running the same comparison. The harness is the reusable part.
