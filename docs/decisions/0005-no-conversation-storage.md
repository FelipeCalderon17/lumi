# 0005 — No conversation storage; consented, previewed gaps with retention

**Status:** Accepted · 2026-10-30 · *Revised 2026-10-30 after Codex review 1: stopped claiming anonymity; added an editable preview, a staff-access disclosure, a topic label, 30-day retention and a delete path.*

## Context
Parents may describe their child's situation in detail. Storing that creates risk (breaches, retention, consent) with little value for a prototype. Staff still need to know what the KB is missing.

An earlier version said gaps were saved "without your name". That overstated it: free text can identify a family even without a name ("my son at the children's hospital downtown with…"), and redaction of free text is unreliable. So we don't call it anonymous.

## Decision
- No accounts and no stored conversations. Questions are sent to OpenAI to route and answer them. The help page discloses this **before** the parent asks.
- After an abstain, the parent is offered: "Would you like to send this question to the Lumi team so they can write a guide?" On yes they see an **editable, minimal preview** of the text that will be stored (contact details removed best-effort), with the note: *"Lumi staff can read the question you choose to save, so remove names and identifying details first. We save the edited question, its language, topic and submission date. Questions older than 30 days are deleted when someone saves a question or staff opens the list."* The note describes the lazy purge below as it really works, rather than promising deletion on day 30.
- Only on an explicit save do we store: the **edited** text, its language, a **router-assigned topic label** (for triage) and a timestamp. No name, IP, user agent or conversation.
- **Retention:** rows older than `config.gaps.retentionDays` (30) are purged on every save and every staff list, so no scheduler is needed.
- **Delete path:** staff can delete any row. On save, the parent gets a one-time delete token (only its SHA-256 hash is stored) and can delete their question from the same tab.

## Consequences
- Very little personal data at rest, and none of it older than 30 days.
- The parent sees and controls exactly what is stored, and knows who can read it.
- No conversation history across visits. Each tab is a fresh conversation.
- Once the tab is closed, the parent can't delete their question themselves; it expires after 30 days, or staff can delete it on request.
- Analytics on unanswered questions depend on parents opting in, so the sample is biased. The ledger's `abstained` outcome count (numbers only) gives the overall rate.
- The topic label comes back from the client with the submission, so it's a triage hint, not trusted data.

## Alternatives
- **Store all conversations for quality review.** Rejected: privacy risk out of proportion for a prototype.
- **Store "anonymised" questions automatically.** Rejected: free-text anonymisation is unreliable, so consent plus a visible preview is the honest boundary.
- **Indefinite retention.** Rejected: there's no reason to keep a question once the guide is written or the topic is triaged.
