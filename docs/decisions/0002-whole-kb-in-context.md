# 0002 — Whole knowledge base in context with prompt caching, no vector DB

**Status:** Accepted · 2026-10-30 · *Revised 2026-10-30 after Codex review 1: corpus size, caching qualified, policy/data separation.*

## Context
The KB starts with **12 short practical articles per language** (~250–450 words each, roughly 6–8k tokens per language). We grow it only where the golden set and the gaps view show missing topics. Answers must be grounded and cite their sources. Retrieval misses are a common way RAG systems fail silently: the right article exists but isn't retrieved, and the model fills the gap.

## Decision
Put the whole KB for the parent's language into the system prompt, after the static policy, as a stable prefix: `[policy][<reference_data> KB with handles [1]..[n] </reference_data>][question]`. The KB block is explicitly marked as reference data, not instructions, and the question sits in its own delimited block. Articles are sorted by id so the prefix is byte-identical across requests, which makes it *eligible* for OpenAI's automatic prefix caching. The model cites integer handles, and `validate/` checks their integrity.

## Consequences
- No retrieval step that can miss. The model always sees every article.
- No embeddings pipeline, vector store or re-indexing.
- Each answer pays for the full KB as input tokens. **Caching isn't guaranteed**: it's best-effort on the provider side and depends on traffic and timing. The ledger records `cachedInputTokens`, and the evals report **measured cold vs warm cost**, so we claim only what we observe.
- Editing any article invalidates the cache until it warms again. That's fine at this edit frequency.
- **Revisit at ~200 articles**, or when the prefix stops fitting comfortably: move to hybrid retrieval (BM25 + embeddings) with the same handle/citation contract.

## Alternatives
- **Vector DB / embeddings RAG.** Rejected for now: more moving parts and a new failure mode (retrieval miss) for a corpus that fits in context.
- **Fine-tuning.** Rejected: can't cite, hard to update, no grounding guarantee.
