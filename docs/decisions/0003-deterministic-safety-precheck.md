# 0003 — Deterministic safety check before any model call and any limit

**Status:** Accepted · 2026-10-30 · *Revised 2026-10-30 after Codex review 1: runs before the length check and rate limiting; adds an explicit self-harm backstop; router gets an `urgent` intent.*

## Context
A parent may type something that is a medical emergency ("she's not breathing", "convulsiona"), or say they're about to hurt themselves. The response has to be immediate and correct even if the model provider is slow, down or misclassifies the message, and even if the parent has hit a rate limit or written a very long message.

## Decision
- `src/server/safety` runs **first**: before the length check, **before rate limiting** and before any model call. It works on the raw text, normalised (lowercase, accents stripped), with keyword/regex rules in EN and ES. **Emergencies are never rate-limited.**
- Two kinds:
  - `medical_emergency` → fixed steps: call 911, tell a nurse / press the call button, outside the US contact local emergency services.
  - `self_harm` (explicit, imminent language only, EN + ES) → fixed steps: 911 if anyone is in immediate danger, call or text 988 (Spanish available), outside-US line. This is a **backstop**: the router's `emotional_crisis` intent stays the main layer for everything less explicit.
- On a match the pipeline makes **no model call**. The copy is fixed, human-reviewed and lives in the UI dictionaries (`safety.*`). Rules lean towards recall.
- **Second layer:** the router lists every intent it sees, including `urgent`. Code applies a fixed precedence: **urgent → emotional_crisis → medical → practical → off_topic**. So a mixed message ("what should I pack, also he's not breathing well") goes to the emergency path even if the rules missed it.
- The help page shows static emergency and 988 lines that don't depend on the API.

## Consequences
- Zero latency and zero cost on the most important path, with no prompt-injection surface.
- False positives show emergency steps for a non-emergency. That's acceptable, and the rules are tuned with the golden set (including figurative phrases like "this parking is killing me").
- Keyword lists miss paraphrases. The router's `urgent` / `emotional_crisis` intents are the second layer; this check isn't the only one.
- The rule id (never the text) is logged so misfires can be tuned.

## Alternatives
- **Let the router classify emergencies.** Rejected as the only layer: depends on the provider being up and on model judgement.
- **Rate-limit first to save CPU.** Rejected: the check is microseconds, and a rate-limited parent in an emergency must still get the steps.
- **Provider moderation endpoint.** Possible extra layer later. It's still a network call, so it can't replace this one.
