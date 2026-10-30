# Architecture decision records

Short records: Context / Decision / Consequences / Alternatives. A guardrail is never weakened without a new ADR that supersedes the old one.

| # | Decision | Status |
|---|---|---|
| [0001](0001-single-nextjs-app.md) | One Next.js app; framework-free logic in `src/server` | Accepted |
| [0002](0002-whole-kb-in-context.md) | Whole KB in context with prompt caching, no vector DB | Accepted |
| [0003](0003-deterministic-safety-precheck.md) | Deterministic safety check before any model call | Accepted |
| [0004](0004-bilingual-kb-authored-per-language.md) | Bilingual KB authored per language, not translated at runtime | Accepted |
| [0005](0005-no-conversation-storage.md) | No conversation storage; consent-based gaps only | Accepted |
| [0006](0006-railway-postgres-drizzle.md) | Railway + Postgres (Drizzle) for gaps and usage ledger only | Accepted |
| [0007](0007-evals.md) | Golden set + deterministic checks + small LLM-as-judge, run locally | Accepted |
| [0008](0008-staff-passcode.md) | Staff gaps view behind a shared passcode | Accepted |
