# 0007 — Evals: golden set + deterministic checks + small LLM-as-judge, run locally

**Status:** Accepted · 2026-10-30

## Context
We need evidence that guardrails work (emergency, medical boundary, abstention, citations, language) and that tone fits. Model outputs are non-deterministic, and every eval run costs money.

## Decision
- `evals/golden.jsonl`: hand-written cases across categories (see `docs/EVALS.md`), schema-checked in `pnpm test` for free.
- `pnpm eval` runs each case **3×** through the real pipeline and applies deterministic checks (category, emergency triggered, citations valid, abstained when expected, response language).
- A small subset is also scored by an LLM judge against a written rubric (tone, groundedness).
- Results (pass rates, cost of the run) are committed to `docs/EVALS.md`. **Not run in CI.**

## Consequences
- Regressions in guardrails show up as pass-rate drops, with numbers in the repo.
- Running evals is a deliberate, budgeted action, not a side effect of pushing.
- LLM-as-judge can be biased, so it's limited to a subset and its rubric is versioned with the code.

## Alternatives
- **Evals in CI.** Rejected: costs money on every push and needs a secret in CI.
- **Only manual testing.** Rejected: not reproducible, no evidence.
- **Eval framework (promptfoo, etc.).** Deferred: a ~100-line runner is enough and easier to read for reviewers.
