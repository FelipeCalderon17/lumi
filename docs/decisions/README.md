# Architecture decision records

Short records: Context / Decision / Consequences / Alternatives. A guardrail is never weakened without a new ADR that supersedes the old one. Revisions that *strengthen* a decision are noted in the ADR's status line.

| # | Decision | Status |
|---|---|---|
| [0001](0001-single-nextjs-app.md) | One Next.js app; framework-free logic in `src/server` | Accepted |
| [0002](0002-whole-kb-in-context.md) | Whole KB in context with prompt caching (measured, not guaranteed), no vector DB | Accepted (revised) |
| [0003](0003-deterministic-safety-precheck.md) | Deterministic safety check before any model call, the length check and rate limits; self-harm backstop | Accepted (revised) |
| [0004](0004-bilingual-kb-authored-per-language.md) | Bilingual KB authored per language, not translated at runtime | Accepted |
| [0005](0005-no-conversation-storage.md) | No conversation storage; consented, previewed gaps with 30-day retention | Accepted (revised) |
| [0006](0006-railway-postgres-drizzle.md) | Railway + Postgres (Drizzle) for gaps and usage ledger only | Accepted |
| [0007](0007-evals.md) | Golden set + deterministic checks + LLM-as-judge, run locally behind a budget guard | Accepted (revised) |
| [0008](0008-staff-passcode.md) | Staff gaps view behind a shared passcode and a signed, expiring session | Accepted (revised) |
| [0009](0009-model-selection.md) | Model selection for the answer step | Accepted (Felipe, 2026-11-01): keep `gpt-6-luna`, from the Phase 4 comparison |
| [0010](0010-buffer-validate-reveal.md) | Buffer, validate, reveal; NDJSON transport | Accepted |
| [0011](0011-medical-fixed-template.md) | Medical questions get a fixed, reviewed template | Accepted |
| [0012](0012-us-scope-and-crisis-contacts.md) | US scope; fixed crisis contacts (911, 988) | Accepted |
| [0013](0013-store-tokens-derive-cost.md) | Store tokens, derive cost (no cost column in the ledger) | Accepted |
| [0014](0014-voice-transcription.md) | Voice to text with `gpt-transcribe`, text only, max 2 minutes, never stored | Accepted |
| [0015](0015-structural-output-checks.md) | Structural, fail-closed output checks: layered dosage backstops (a finite detector: verb rules + verb-independent rules, accepted over-withholding, listed residual vocabulary) and a notebook with no AI prose (the model only classifies; every note shown verbatim) | Accepted (Felipe, 2026-10-31) |
| [0016](0016-phase-3-ui.md) | Phase 3 UI: the deep Ask Lumi slice, an on-device notebook, honest mocks, the 911/988 strip on every page, a footer-only demo phone number | Accepted (Felipe, 2026-11-01) |
