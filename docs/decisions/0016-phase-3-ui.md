# 0016 — Phase 3 UI: one deep slice, honest mocks, on-device state

**Status:** Proposed · 2026-10-31 · *Phase 3 (UI). Revised after Codex's Phase 3 review (fixes round 1). Pending re-review and Felipe's sign-off.*

## Context
The brief asks for one slice done deeply and reasonable placeholders for the rest. The server side (Phases 0–2) is done: the chat pipeline, notebook classification, voice, gaps, staff and the ledger. Phase 3 is the site a stressed parent actually sees, often on a phone at 2 a.m. It must also look like something FutureProofing would proudly show a client, without any "AI template" look. Nothing in this phase may weaken a server guardrail.

## Decision

**Look and feel** (docs/DESIGN.md, "a lantern on the night table")
- Night (indigo) and dawn (warm paper) themes follow `prefers-color-scheme`. A toggle saves a manual choice on the device (`localStorage`), and a fixed inline script applies it before first paint (`next/script`, `beforeInteractive`).
- Fraunces headings, Atkinson Hyperlegible Next body at 18px, one amber accent. Line illustration (a window at night, a lantern, a paper boat, fireflies), no photos. A still paper-grain texture.
- Motion is slow and small, and `prefers-reduced-motion` turns it all off (verified in the browser: animation duration ~0).
- Shared utilities (`btn-lantern`, `btn-quiet`, `btn-ember`, `field`, `eyebrow`, `link`) live in `globals.css`, not a component library.

**Safety layer 3 on every page**
- A calm strip above the header: "Emergency? Call 911" and "In crisis? Call or text 988" as `tel:` links. "More" (a `<details>` with an SVG chevron) opens the full reviewed banner lines and the Call 911 / Call 988 / Text 988 buttons.
- The "More" panel expands **in flow**: the strip grows and pushes the page down. An overlay was tried first and painted under the header (every `body > *` is its own stacking context at `z-index: 1`, the header is `z-20`), so the text collided with the logo and the page title. In flow is calmer and can't collide.
- It's static HTML from `safety.strip` / `safety.actions`, so it works without JavaScript, the AI or the API. On phones it's two short rows, in Spanish too.

**Ask Lumi (the deep slice)**
- `src/lib/chat-client.ts` reads the NDJSON stream over `fetch` with an `AbortController`. It returns the **first** terminal event and stops reading.
  - A premature EOF, an unparseable or unknown line, a network error, or any non-2xx except `400 too_long` becomes the fixed fallback (911 included).
  - `too_long` shows inline and keeps the text.
  - A new question, "Start over" or leaving the page aborts the request in flight.
- While waiting, the page shows one calm line with a slow glow: "Looking through our family guides…".
- Every terminal event is rendered from the reviewed dictionary copy. Model text appears only in `answer`, rendered by a tiny Markdown reader that never produces HTML. Answers show **plain text**: the citation markers are removed from the display (`stripCitations`, UI feedback round 4), and the guides the answer cites are listed once below it, in order, as links to `/[locale]/guides/[id]` ("From these guides"). The model must still cite, and the server still validates every citation; only the display changed.
- The other events:
  - `medical`: adds "+ Add to my notebook" (the question becomes a note).
  - `crisis`: 988 first, then a gentle link to Parent Circles.
  - `abstained`: runs the gap flow (below).
- **The conversation is session-only:** a list in this tab's memory, never persisted (ADR 0005).
- **One chat card, one column:** the turns ("You asked" + the question, then Lumi's response) and the composer share one full-width surface card, so an answer never floats on the page background. The quick-start chips (before the first question) and the boundaries note sit below the card. Answer text keeps a 76ch measure inside it. Calm safety cards are a borderless raised panel (no box in a box), and ember cards keep their outline. The separate "lives only in this tab" note row was removed (Felipe's UI feedback, round 1); the processing notice still says Lumi doesn't save the conversation.
- **The conversation scrolls inside the card** (UI feedback, round 2), so the card stops growing and the composer stays at its bottom, always visible:
  - The turns sit in a capped scroll area: `min(60vh, 40rem)` on larger screens; on phones `max(16rem, 100dvh − 24rem)`, the height left once the card header, the composer and the page's scroll padding are on screen, so the whole card fits the viewport. With one short answer the card stays short.
  - It's a labelled `<section>` (a region landmark, `help.conversationLabel`) with `tabIndex={0}` and an inset focus ring, so keyboard users can scroll it with the arrow keys. `aria-live="polite"` stays on the list. `overscroll-behavior: contain` keeps the page still when the area hits its end. A soft inset shadow at the top shows there's more above (it never covers text or catches clicks).
  - When a turn is added and when its response arrives, the **area** scrolls (instantly under reduced motion) so the newest question is at its top. If that would leave the response below the area's fold, the response start goes to the top instead. Emergency and crisis cards go to the top whenever they don't fit whole under the question, so the call buttons show without scrolling (where the card fits the area). The page itself only scrolls if the card isn't fully on screen (`scrollIntoView({ block: "nearest" })`).
  - A compact "Start over" sits in the card's header row, outside the scroll area, once there is a turn.
- **No inline citations in answers** (UI feedback, round 4): Felipe found a pill on every line ("7" after each bullet) too much. One pill per guide was considered, then dropped in favour of no pills at all, for a calmer read. The "From these guides" list below each answer is now the only place sources appear. Tradeoff: the parent can't see which sentence came from which guide.
- **The gap flow** (ADR 0005):
  - An editable preview, redacted with the server's own function (moved to the Node-free `src/server/gaps/redact.ts`), plus the disclosure and a consent checkbox.
  - Every save status is handled. `uncertain` offers a retry with the same id and token, and a delete.
  - The delete token lives only in component state, so "Delete my question" works while the tab is open.

**My notebook**
- Notes live only in `localStorage` (`src/lib/notebook-store.ts`). Corrupt data is recovered (valid notes kept, the rest dropped, and the parent is told). Timestamps carry the device's own offset, so the printed date is the parent's local date.
- A single delete has an Undo. "Delete everything" asks first, with focus on the safe choice.
- The processing notice (`notebook.processingNotice`, naming OpenAI; ADR 0005) sits next to the button, so it's seen before anything is sent.
- Prepare sends at most `maxNotes` (the most recent 40).
- The page renders the current contract:
  - Safety notices come first, before any note, on every sheet: organized, fallback, 400 responses and the by-date page (see "Revision 1").
  - Topic headings come from the dictionaries.
  - Note text is rendered verbatim (`white-space: pre-wrap`), with the wall-clock date the device wrote.
- If preparing fails (or the device is offline), "Print my notes by date" builds the same page on the device without AI, with the safety notices.
- Print uses a print stylesheet: ink on white, a header with the date, and no navigation or buttons.
- Share uses the Web Share API where available, and otherwise copies to the clipboard. There's also a plain "Copy". Shared and copied text starts with the full fixed safety notice (title, body and every step, in the page's language) when one applies, then the notes verbatim.

**Guides:** the KB articles themselves, as a library and article pages. An answer's Sources list links there.

**Page width:** every page, Ask Lumi and guide articles included, uses the same `max-w-6xl px-5` container as the header and footer, so the edges line up. Long text keeps a reading measure (68ch) inside it. Ask Lumi is a single column at every width (round 2: a wide card that grows less in height). On large screens a guide article gets a side column with the Ask Lumi card and "More on this topic" (same category); it stacks on phones.

**Placeholders done honestly**
- Community, Volunteer and Donate are **mocks**, each with a "Demo" badge and a line saying nothing is sent.
- **Community:** Parent Circles are grouped by situation (not diagnosis). Schedules use time-of-day words, because the content rules read clock times as dose schedules. "Join (demo)" only flips a label. There are no testimonials, quotes or names.
- **Volunteer:** six example roles, with filters for time, place and skills, and a client-validated demo sign-up that sends nothing.
- **Donate:** an amount picker mapped to a fixed, reviewed "what your gift could fund" table labelled illustrative (no AI), a once/monthly toggle, a review step that collects no card details ("Demo: no payment is processed"), and a thank-you.

**Staff:** `/[locale]/staff` signs in with the passcode, then shows saved questions (with a soft-tombstone delete) and the usage summary with derived cost and the `complete` flag, then signs out. `503` shows a fail-closed message. Fetches use `cache: "no-store"`; the server already sends `private, no-store`. The old `/staff/gaps` redirects here.

**Language:** `[locale]` routes and all copy in the dictionaries (Spanish with "tú"). The language switch is a **full page load**, because it swaps `<html lang>`, and a client re-render of the root layout warned about the theme script and dropped the saved theme.

**Footer:** "Lumi is a fictional foundation. Demo content. Not medical advice." It also holds the **only** non-safety phone number on the site, a fictional `555-0142` in `footer.contactPhone`, enforced by the dictionary tests (ADR 0012).

## Revision 1: Phase 3 fixes round 1 (Codex review)

**Safety notices can't be lost on the device (B1, B4)**
- The notebook page runs the **same** deterministic check as the server (`checkEmergency` from `src/server/safety`). That module is pure TypeScript with no Node APIs, so it's imported directly. Nothing was copied, and the server rules are unchanged.
- `src/lib/notebook-sheet.ts` builds every sheet. It merges the server's notices with the local check: a note is flagged if either flags it, and one notice is shown per kind, medical emergency first.
- The error panel shows the notices from a 400 together with the local check. "Print my notes by date" keeps both. Offline, the local check alone flags the page.
- A server notice on the by-date page contributes only its **kind**. Its `noteIndex` refers to the request, which may differ from the notes now on the page (notes added since, or the 40-note cap), so the flag dots come from the local check.
- `src/lib/notebook-safety.ts` holds the kind → copy mapping, used by both the screen and Copy/Share. The export can't drift from the screen: it includes the title, the body and every step, so the self-harm notice carries 911 and 988.

**Verbatim means verbatim (B5):** `addNote` stores the string exactly as typed, including leading and trailing whitespace and newlines. `trim` is only used to refuse a blank note. The request sends the same string, and the server already showed notes untrimmed. The list and the sheet render with `white-space: pre-wrap`.

**No microphone after leaving (B2):** each start takes a token, and unmounting bumps it. `openMicrophone` (src/lib/voice.ts) checks the token after the permission prompt resolves. A stale stream has every track stopped at once, and no recorder is created.

**Staff sign-out is confirmed (B3):** the session cookie is httpOnly, so only the server can clear it. The page shows sign-in only after `/api/staff/logout` answers `200 {status:"ok"}`. Otherwise the dashboard stays, with "Couldn't sign you out. Try again." and a retry button (EN/ES).

**Polish**
- **Phone landing:** the headline, lede and "Ask Lumi a question" come before the illustration below `lg`. At 390 × 844 the button ends at about 570–620 px, above the fold.
- **Citation pills** (superseded in UI feedback round 4: answers no longer show inline pills, see above): `collapseRepeatedCitations` was presentation only, and only for answers. A run of consecutive citations to the same single guide (across sentences, bullets and paragraphs) shows one pill at its end. A grouped citation ("[1, 3]"), a change of guide or a heading ends the run. An answer that cites one guide throughout shows a single pill. The Sources list and the citation checks are untouched.
- **Ask box focus:** when the textarea has focus, the box gets an amber border and a 3 px ring. (After the one-card layout, the ring is on the whole chat card while the composer has focus; the gap flow's textarea doesn't trigger it.)
- **Volunteer:** scrolling to the sign-up form uses `behavior: "auto"` under `prefers-reduced-motion`.

**Tradeoffs accepted in this revision**
- The safety regexes now also ship in the browser bundle. They're public in the repo anyway, and they're small. A client that skips them only hurts itself, because the server still checks every note before preparing.
- (Superseded in round 4, when inline pills were removed.) A collapsed run leaves earlier sentences without their own pill. The claim's source is the next pill in the run, which is always the same single guide, so the association stays correct but less explicit.
- Notes typed with stray trailing spaces or blank lines print that way. That's the cost of "the parent's own words, exactly".
- The by-date page shows server notices by kind, without pointing at a note, when only the server matched. This can only happen if the server and client rules diverge, which they can't with a shared module.

## Revision 2: Phase 3 fixes round 2 (Codex final verification)

**Urgent actions first (B6, safety visibility).** On a phone, the self-harm and crisis cards (about 800 px) start at the top of the chat's scroll area (about 460 px), and their 988/911 buttons sat 640–760 px down, so they needed manual scrolling. In `SafetyCard`, urgent (ember) cards (emergency, self-harm, crisis) now render their call buttons **directly under the heading**, before the body and the numbered steps. The reviewed copy and the button order are unchanged: "Call 911" filled and most prominent for an emergency; 988, Text 988, then 911 for self-harm and crisis. Calm cards (medical, off-topic, abstained, fallback) keep their actions at the end. The notebook's safety notices use the same order (the call button under the title). Checked: the heading and the first button are fully inside the scroll area right after the response arrives, for all three kinds, in EN and ES at 390 × 844 and 1280, as the first or the 5th turn, with and without reduced motion.

**Sources list without numbers.** With no inline markers in answers, the circled citation numbers in "From these guides" matched nothing. The list now shows plain linked guide titles in order, with a small decorative sage dot. `role="list"` keeps list semantics in Safari, which drops them for unstyled lists.

**Smaller fixes.** `stripCitations` keeps exactly one space where a marker sat between two words or formatted runs ("Ask [2]**the social worker**" used to render as "Askthe social worker"). It collapses only before punctuation or at the start or end of a line, item or run. The emergency strip's 911/988 links are now 44 px tap targets on phones, and the Spanish strip still fits two rows at 390 px.

## Consequences
- The deep slice is complete end to end, and every failure ends in calm, fixed copy with 911.
- The rest of the site feels real but never pretends: badges, dashed borders and "nothing is sent" lines.
- On-device state (notebook, theme) is private and needs no accounts. It's also **device-bound**: it doesn't sync, and clearing browser data deletes it.
- The conversation disappears with the tab. A parent can't come back to an answer later, except through the notebook.
- No new runtime dependencies. The browser check ran with a scratch `playwright-core` outside the repo.

## Known limitations (README tradeoffs table)
- **Device-bound notebook:** no sync or backup. Browser storage limits apply, and some private modes block storage (the page then says it couldn't save).
- **Voice support:** browsers without `MediaRecorder` or `getUserMedia` don't see the mic. Headless checks covered the unsupported, denied, countdown and auto-stop states. The real recording was Chrome's synthetic tone, which correctly came back `empty`. Real speech is still pending (ADR 0014).
- **Print and share:** the print layout was checked in Chromium's print emulation only. Web Share depends on the browser and OS. Without it, "Share" copies, and clipboard access can be refused.
- **Mock pages:** no backend for circles, volunteer sign-up or donations, and no payment processor.
- **Mock schedules:** no clock times, because the dosage gate in the content rules flags them in UI copy.
- **First-save network error:** if the very first gap save loses its response, the UI says "couldn't save". The id is created by the server, so the page has no credentials to retry or delete. The lazy retention and staff delete still apply.
- **Staff 401 in the console:** opening the staff page before signing in logs one browser "401" line. It's the session check, by contract.
- **Generic notebook rate-limit wording:** a rate-limited (or capacity-limited) prepare returns the by-date fallback page with the generic "We couldn't sort your notes by topic right now" line, not a specific "try again in a few minutes". Left as is after the Phase 3 review.
- **Narrow screens and zoom:** checked at 390 px and 1280 px only. 320 px widths and 200% browser zoom weren't systematically checked. Left as is after the Phase 3 review.

## Alternatives
- **A component library (shadcn/Radix).** Rejected: it brings the template look we're avoiding, and a few utilities were enough.
- **Persisting the conversation in `localStorage`.** Rejected: ADR 0005 promises that each tab is a fresh conversation, and a shared phone would keep a parent's questions. The notebook is the explicit, controllable place to keep things.
- **Server-rendered theme from a cookie.** Rejected: it would make every page dynamic, for a cosmetic preference.
- **Real payment and sign-up integrations.** Out of scope for the brief, and they'd need real organisations.
