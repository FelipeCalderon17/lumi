# 0004 — Bilingual KB authored per language, not translated at runtime

**Status:** Accepted · 2026-10-30

## Context
Many families the foundation would serve are more comfortable in Spanish. In a sensitive domain, a stilted or wrong translation erodes trust, and runtime translation adds a model call and a new failure mode.

## Decision
Each article exists as `content/kb/en/<id>.md` and `content/kb/es/<id>.md` with the same `id`, written (or carefully adapted and reviewed) in each language. The router detects the question's language. The answer step loads only that language's KB and answers in that language. UI strings are typed dictionaries; Spanish must satisfy the English type.

## Consequences
- Spanish answers cite Spanish articles, so citations open text the parent can read.
- Parity is checked automatically (same ids in both folders) once articles exist.
- Twice the writing and review work for every article. That's acceptable at 12 articles per language and is the honest cost of being bilingual.
- If the question's language differs from the page locale, we answer in the question's language (golden set covers it).

## Alternatives
- **Single English KB + runtime translation.** Rejected: extra cost and latency per request, and translation errors would be presented as grounded content.
- **Single KB, model answers in the user's language from English sources.** Rejected: citations point to text the parent may not read.
