# 0012 — US scope; fixed crisis contacts (911 and 988)

**Status:** Accepted · 2026-10-30 · *From Codex review 1 (open question 3), decided by Felipe.*

## Context
Emergency and crisis copy depends on the country. The earlier content rules allowed only the generic 911, which left the crisis path without a real crisis line. Spanish-speaking families outside the US use other numbers.

## Decision
- Lumi operates in the **United States** and serves English- and Spanish-speaking families.
- Fixed, human-reviewed contact copy, in both languages:
  - **911** for emergencies.
  - **988 Suicide & Crisis Lifeline**: call or text 988, Spanish available, for emotional crisis.
  - Outside the US: **"contact your local emergency services"**.
- 988 is a public US service. It may appear **only** in the fixed safety copy (`safety.*` and the static crisis banner in the dictionaries) and in the identical crisis line in the self-care KB article. Tests enforce this, and no other phone numbers may appear anywhere.
- Lumi never invents other organisations or numbers (hospital lines are described, not numbered: "your hospital's emergency line").

## Consequences
- The crisis path gives a parent something they can do tonight, in their language.
- Families outside the US get a generic but correct instruction, not a wrong number.
- Expanding to another country means a new ADR and per-country copy.
- The Spanish copy currently uses the English service name. Whether to use an official Spanish name is an open question (ARCHITECTURE.md).

## Alternatives
- **Only 911 everywhere.** Rejected: 911 isn't the right first step for emotional crisis.
- **Per-country numbers by IP geolocation.** Rejected: unreliable, a privacy cost, and a wrong number in a crisis is worse than a generic instruction.
