# 0005 — No conversation storage; consent-based gaps only

**Status:** Accepted · 2026-10-30

## Context
Parents may describe their child's situation in detail. Storing that creates risk (breaches, retention, consent) with little value for a prototype. Staff still need to know what the KB is missing.

## Decision
No accounts and no stored conversations. When the assistant abstains, the parent is offered: "Save this question (without your name) so the team can write a guide?" Only on an explicit yes do we store the question text, language and timestamp in `gap_question`. Contact details are stripped best-effort, and the UI asks not to include names.

## Consequences
- Very little personal data at rest. Nothing to export or delete per user.
- No conversation history across visits. Each tab is a fresh conversation.
- Analytics on unanswered questions depend on parents opting in, so the sample is biased. The ledger's `abstained` outcome count (numbers only) gives the overall rate.

## Alternatives
- **Store all conversations for quality review.** Rejected: privacy risk out of proportion for a prototype.
- **Store anonymised conversations automatically.** Rejected: free-text anonymisation is unreliable, so consent is the honest boundary.
