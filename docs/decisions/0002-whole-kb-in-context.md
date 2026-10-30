# 0002 — Whole knowledge base in context with prompt caching, no vector DB

**Status:** Accepted · 2026-10-30

## Context
The KB is ~20–25 short practical articles per language, around 15k tokens. Answers must be grounded and cite their sources. Retrieval misses are a common way RAG systems fail silently: the right article exists but isn't retrieved, and the model fills the gap.

## Decision
Put the whole KB for the parent's language into the system prompt, after static rules, as a stable prefix: `[rules][KB with handles [1]..[n]][question]`. Articles are sorted by id so the prefix is byte-identical across requests and OpenAI's automatic prefix caching applies. The model cites integer handles, which `validate/` checks.

## Consequences
- No retrieval step that can miss. The model always sees every article.
- No embeddings pipeline, vector store or re-indexing.
- Each answer pays for ~15k input tokens, mostly at the cached rate. The ledger tracks `cacheReadTokens` to confirm caching actually happens.
- Editing any article invalidates the cache until the next request warms it. That's fine at this edit frequency.
- **Revisit at ~200 articles** or when the prefix stops fitting comfortably: move to hybrid retrieval (BM25 + embeddings) with the same handle/citation contract.

## Alternatives
- **Vector DB / embeddings RAG.** Rejected for now: more moving parts and a new failure mode (retrieval miss) for a corpus that fits in context.
- **Fine-tuning.** Rejected: can't cite, hard to update, no grounding guarantee.
