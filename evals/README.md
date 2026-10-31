# Evals

Plan and results: [docs/EVALS.md](../docs/EVALS.md).

- `golden.jsonl` — one case per line, validated by `GoldenCaseSchema` in `golden.ts` (checked in `pnpm test`, free).
- `notebook.jsonl` — notebook cases, validated by `NotebookCaseSchema` in `notebook.ts`.
- `run.ts` — `pnpm eval` launcher: `pnpm eval --dry-run` estimates, `LUMI_LIVE=1 pnpm eval` calls the real models (**costs money**, budget-guarded, never in CI). It starts `eval.live.ts` under vitest for the TypeScript resolution.
- `lib/` — the runner: plan and budget guard (`plan.ts`, `budget.ts`), deterministic checks (`checks.ts`, `notebook-checks.ts`), the versioned judge prompt and schema (`judge.ts`), withholding attribution (`withholding.ts`), the output-capturing model wrapper (`capture.ts`), aggregation and Markdown (`report.ts`, `render.ts`). Unit-tested with mocked models (`*.test.ts`, free, in `pnpm test`).
- `runs/` — raw outputs of live runs (git-ignored). Results are summarised in docs/EVALS.md § Results.

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
