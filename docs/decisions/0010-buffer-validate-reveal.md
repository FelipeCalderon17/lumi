# 0010 — Buffer, validate, reveal (no unvalidated model text reaches the parent)

**Status:** Accepted · 2026-10-30 · *From Codex review 1 (blocker B1), decided by Felipe.*

## Context
The first design streamed answer tokens to the parent and checked citations only at the end. If the check failed, the text would have to be withdrawn after the parent had already read it. For a frightened parent, reading an unchecked sentence and then seeing it vanish is worse than waiting a few seconds. Streaming into a "drafting" state still shows unchecked text.

## Decision
- The answer is generated with `streamText` (so a stalled provider is detected early by a first-token timer) but **buffered on the server**. Nothing from the model is sent to the client until the full text has passed:
  1. the **completion check** (`interpretCompletion`): `finishReason` must be `stop`. `length` → fallback(truncated), anything else → fallback(interrupted). The abstain marker is detected on the full text, so a marker split across chunks still works.
  2. **citation integrity** (`validate/`);
  3. the **output checks** (`findUnsafeOutput`): no phone numbers other than 911/988, and the structural, fail-closed dosage gate ([ADR 0015](0015-structural-output-checks.md)).
- While waiting, the server sends a `progress` event, and the UI shows a calm, static state: *"Looking through our family guides…"* / *"Buscando en nuestras guías para familias…"*. No typing animation.
- The validated answer is revealed in one piece as a single terminal `answer` event.
- **Transport:** NDJSON over `fetch`, exactly one terminal event per request, cancellation via `AbortSignal`, and the client shows the fallback on a non-2xx or a stream that ends without a terminal event (contract in [ARCHITECTURE.md § Transport](../ARCHITECTURE.md#transport)).
- Latency (p50/p95, router + answer) is recorded in the evals so the cost of waiting is measured, not guessed.

## Consequences
- The parent never sees text that later turns out to be truncated, uncited or invalid.
- Time-to-first-word becomes time-to-full-answer, a few seconds longer. `maxAnswerOutputTokens` and short answers keep it bounded, and `answerTotalMs` (25 s) is the hard ceiling.
- Simpler UI: no partial-text states, no withdrawals, and `aria-live` announces one complete answer.
- Integrity isn't grounding (see ARCHITECTURE.md § What citation integrity does and doesn't guarantee). Buffering only means what we reveal has passed the checks we have.

## Alternatives
- **Stream and replace with a fallback on failure.** Rejected: the parent has already read the unchecked text.
- **Stream into a visually "drafting" state.** Rejected (it was the earlier leaning): still shows unchecked text, and "drafting" styling doesn't stop someone acting on it.
- **AI SDK UI message streams + `useChat`.** Rejected for transport: the stream is one typed event, so a plain NDJSON reader is simpler and fully typed.
