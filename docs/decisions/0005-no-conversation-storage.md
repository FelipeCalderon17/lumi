# 0005 — No conversation storage; consented, previewed gaps with retention

**Status:** Accepted · 2026-10-30 · *Revised 2026-10-30 after Codex review 1: stopped claiming anonymity; added an editable preview, a staff-access disclosure, a topic label, 30-day retention and a delete path. Revised again after Codex review 2: the gap note describes the lazy purge honestly, and naming OpenAI is recorded as an explicit exception to the no-real-organisations rule. Revised after Codex re-review 6: notebook notes sent for classification, `store: false`, Lumi's storage policy vs. provider processing, staff tombstones and what a tombstone keeps. Wording fix after Codex verification: tombstone retention is lazy and counted from `created_at`, not a hard 30-day ceiling.*

## Context
Parents may describe their child's situation in detail. Storing that creates risk (breaches, retention, consent) with little value for a prototype. Staff still need to know what the KB is missing.

An earlier version said gaps were saved "without your name". That overstated it: free text can identify a family even without a name ("my son at the children's hospital downtown with…"), and redaction of free text is unreliable. So we don't call it anonymous.

## Decision
- No accounts and no stored conversations. Questions are sent to OpenAI to route and answer them. The help page discloses this **before** the parent asks.
- **Notebook notes stay on the parent's device.** Lumi never stores them server-side. When the parent asks Lumi to organise them, the notes are sent to OpenAI for **one classification call** (a topic per note, ADR 0015). The response is built from the notes themselves, returned and forgotten; nothing is written to the database or the logs, and the ledger row holds numbers only. Phase 3 shows a processing notice on the notebook page before the first prepare, like the help page's.
- **Lumi's storage policy vs. provider processing.** Two different things, and we claim only the first:
  - *What Lumi stores:* no conversations, no notebook notes, no audio. Only consented gap questions (below) and the numbers-only usage ledger.
  - *What the provider processes:* every chat question, every notebook note sent for classification and every voice recording sent for transcription reaches OpenAI. It's processed under OpenAI's API data terms. Every text call (router, answer, notebook) sets **`store: false`** (`config.openai.store`), so we don't ask OpenAI to keep the request as a stored response. That's a request option, not a guarantee about OpenAI's own processing or abuse-monitoring retention, which their terms govern.
- **Naming the processor is a deliberate exception** (decided by Felipe after Codex review 2): transparency about who processes a parent's words wins over the no-real-organisations rule. Real organizations are not used or imitated, except naming the AI data processor (OpenAI) in privacy disclosures, and the public 911/988 services in fixed safety copy. "OpenAI" appears only in `help.processingNotice` and the `how-lumi-can-help` article, and tests keep it there.
- After an abstain, the parent is offered: "Would you like to send this question to the Lumi team so they can write a guide?" On yes they see an **editable, minimal preview** of the text that will be stored (contact details removed best-effort), with the note: *"Lumi staff can read the question you choose to save, so remove names and identifying details first. We save the edited question, its language, topic and submission date. Questions older than 30 days are deleted when someone saves a question or staff opens the list."* The note describes the lazy purge below as it really works, rather than promising deletion on day 30.
- Only on an explicit save do we store: the **edited** text, its language, a **router-assigned topic label** (for triage) and a timestamp. We do not collect a separate name field, IP address, user agent or conversation history. The saved question may still contain identifying details.
- **Retention:** rows older than `config.gaps.retentionDays` (30) are purged on every save and every staff list, so no scheduler is needed.
- **Delete path:** staff can delete any row. On save, the parent gets a one-time delete token (only its SHA-256 hash is stored) and can delete their question from the same tab. **Both deletes leave a tombstone.**
  - A parent delete blanks the question and leaves a tombstone on the id, so a save that was still in flight can't store it afterwards (added after Codex re-review 3).
  - A staff delete is the same soft tombstone, an `UPDATE` and never a `DELETE`, so a parent retry with the original id and token can't store the question again (added after Codex re-review 4).
  - **What a tombstone keeps:** the id, the delete-token hash, the language, the consent flag (always true), `deleted = true` and `created_at`. The question is blanked (`""`) and the topic reset to `other`. A tombstone the parent creates before the save lands has language `en` as a placeholder.
  - Tombstones are hidden from staff and purged with the same lazy 30-day retention, counted from the row's original `created_at` (not the delete time). Only the purge physically removes rows.

## Consequences
- Very little personal data at rest. Questions older than 30 days are deleted on the next question save or staff list request; they may remain stored longer if neither occurs.
- The parent sees and controls exactly what is stored, and knows who can read it.
- No conversation history across visits. Each tab is a fresh conversation.
- Once the tab is closed, the parent can't delete their question themselves. Questions older than 30 days are deleted on the next question save or staff list request; staff can also delete them.
- Analytics on unanswered questions depend on parents opting in, so the sample is biased. The ledger's `abstained` outcome count (numbers only) gives the overall rate.
- The topic label comes back from the client with the submission, so it's a triage hint, not trusted data.
- A tombstone keeps a little metadata (id, token hash, language, date) until the purge removes it. That isn't a hard 30-day ceiling: the purge is lazy (next question save or staff list request), and expiry is counted from the row's original `created_at`, not from the delete. It has no question text, and it's needed so a delete can't be undone by a late or retried save.
- Notebook notes and chat questions leave the device for the provider call. "Not stored by Lumi" is accurate; "never leaves your phone" would not be, and the copy must not say it.

## Alternatives
- **Store all conversations for quality review.** Rejected: privacy risk out of proportion for a prototype.
- **Store "anonymised" questions automatically.** Rejected: free-text anonymisation is unreliable, so consent plus a visible preview is the honest boundary.
- **Indefinite retention.** Rejected: there's no reason to keep a question once the guide is written or the topic is triaged.
