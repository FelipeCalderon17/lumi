# 0003 — Deterministic safety check before any model call

**Status:** Accepted · 2026-10-30

## Context
A parent may type something that is a medical emergency ("she's not breathing", "convulsiona"). The response has to be immediate and correct even if the model provider is slow, down, rate-limited or misclassifies the message.

## Decision
`src/server/safety` runs first on the raw text: normalised (lowercase, accents stripped) keyword/regex rules in EN and ES. On a match the pipeline returns fixed, human-written emergency steps (call 911, the hospital's emergency line, the care team) and makes **no model call**. Rules lean towards recall. The help page also shows a static emergency line that doesn't depend on the API.

## Consequences
- Zero latency and zero cost on the most important path; no prompt injection surface.
- False positives show emergency steps for a non-emergency. Acceptable and tuned with the golden set.
- Keyword lists miss paraphrases. The router's `emotional_crisis` / `medical` categories and the answer rules act as second layers; this check isn't the only one.
- The rule id (never the text) is logged so misfires can be tuned.

## Alternatives
- **Let the router classify emergencies.** Rejected as the only layer: depends on the provider being up and on model judgement.
- **Provider moderation endpoint.** Possible extra layer later; still a network call, so it can't replace this one.
