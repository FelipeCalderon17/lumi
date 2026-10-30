# Evals

Plan and results: [docs/EVALS.md](../docs/EVALS.md).

- `golden.jsonl` — one case per line, validated by `GoldenCaseSchema` in `golden.ts` (checked in `pnpm test`, free).
- `run.ts` — `pnpm eval`. Calls the real model, **costs money**, never runs in CI. Stub in Phase 0.

## Case format

```json
{
  "id": "practical-en-001",
  "input": "Can I bring my other kids when we go for chemo days?",
  "locale": "en",
  "expect": { "category": "practical", "language": "en", "emergency": false, "abstain": false, "mustCite": true },
  "tags": ["practical", "en"]
}
```

Only the `expect` fields that are present are checked. `judge: true` adds the case to the LLM-as-judge subset.
