# 0007 — Evals: golden set + deterministic checks + LLM-as-judge, run locally behind a budget guard

**Status:** Accepted · 2026-10-30 · *Revised 2026-10-30 after Codex review 1: groundedness judge on every generated answer, model comparison (ADR 0009), budget guard, latency, mocked failure tests.*

## Context
We need evidence that guardrails work (emergency, crisis, medical boundary, abstention, citation integrity, language) and that answers are actually supported by the articles they cite. Model outputs are non-deterministic, and every eval run costs money.

## Decision
- `evals/golden.jsonl`: hand-written cases across categories (see `docs/EVALS.md`), schema-checked in `pnpm test` for free, with expected articles checked against the real KB.
- `pnpm eval` runs the cases through the real pipeline and applies deterministic checks (outcome, category, which layer caught an emergency, citation integrity, expected article cited, abstention, language, no dosage, care-team mention).
- An **LLM-as-judge** (`config.models.judge`, not one of the cheap candidates) scores every generated answer for **groundedness/unsupported claims**, plus a rubric subset for boundary, tone, usefulness and Spanish quality.
- **Safety outputs also get a manual human review** by Felipe; the judge isn't trusted alone on safety.
- A **budget guard** estimates the run's cost before any call and aborts above `config.evals.budgetCapUsd` ($2 by default).
- The answer-model comparison (ADR 0009) uses the same harness.
- Results (pass rates, latency p50/p95, cost of the run, cold vs warm cost) are committed to `docs/EVALS.md`. **Not run in CI.**
- Failure handling (provider error, timeout, DB down, client disconnect) is covered by **mocked unit tests** in `pnpm test`, not by evals.

## Consequences
- Regressions in guardrails show up as pass-rate drops, with numbers in the repo.
- Running evals is a deliberate, budgeted action, not a side effect of pushing.
- LLM-as-judge can be biased. Its rubric is versioned with the code, it's a different model from the default answer model, and safety is also reviewed by a human.

## Alternatives
- **Evals in CI.** Rejected: costs money on every push and needs a secret in CI.
- **Only manual testing.** Rejected: not reproducible, no evidence.
- **Eval framework (promptfoo, etc.).** Deferred: a small runner is enough and easier for reviewers to read.
