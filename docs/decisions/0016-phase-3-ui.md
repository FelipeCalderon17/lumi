# 0016 — Phase 3 UI: one deep slice, honest mocks, on-device state

**Status:** Proposed · 2026-10-31 · *Phase 3 (UI). Pending review and Felipe's sign-off.*

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
- Every terminal event is rendered from the reviewed dictionary copy. Model text appears only in `answer`, rendered by a tiny Markdown reader that never produces HTML. Citation handles become links to `/[locale]/guides/[id]`, followed by a Sources list.
- The other events:
  - `medical`: adds "+ Add to my notebook" (the question becomes a note).
  - `crisis`: 988 first, then a gentle link to Parent Circles.
  - `abstained`: runs the gap flow (below).
- **The conversation is session-only:** a list in this tab's memory, never persisted (ADR 0005).
- **One chat card:** the turns ("You asked" + the question, then Lumi's response) and the composer share one surface card, so an answer never floats on the page background. Calm safety cards inside it are a borderless raised panel (no box in a box), and ember cards keep their outline. A compact "Start over" sits in the card's top-right corner once there is a turn. The separate "lives only in this tab" note row was removed (Felipe's UI feedback, round 1); the processing notice still says Lumi doesn't save the conversation.
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
  - Safety notices come first, on organized pages, fallback pages and 400 responses.
  - Topic headings come from the dictionaries.
  - Note text is rendered verbatim (`white-space: pre-wrap`), with the wall-clock date the device wrote.
- If preparing fails, "Print my notes by date" builds the same page on the device without AI.
- Print uses a print stylesheet: ink on white, a header with the date, and no navigation or buttons.
- Share uses the Web Share API where available, and otherwise copies to the clipboard. There's also a plain "Copy". Shared and copied text is the notes verbatim.

**Guides:** the KB articles themselves, as a library and article pages. Citations link there.

**Page width:** every page, Ask Lumi and guide articles included, uses the same `max-w-6xl px-5` container as the header and footer, so the edges line up. Long text keeps a reading measure (68ch) inside it. On large screens the extra width becomes a side column: the quick-start chips and the boundaries note on Ask Lumi; the Ask Lumi card and "More on this topic" (same category) on a guide. Both stack on phones.

**Placeholders done honestly**
- Community, Volunteer and Donate are **mocks**, each with a "Demo" badge and a line saying nothing is sent.
- **Community:** Parent Circles are grouped by situation (not diagnosis). Schedules use time-of-day words, because the content rules read clock times as dose schedules. "Join (demo)" only flips a label. There are no testimonials, quotes or names.
- **Volunteer:** six example roles, with filters for time, place and skills, and a client-validated demo sign-up that sends nothing.
- **Donate:** an amount picker mapped to a fixed, reviewed "what your gift could fund" table labelled illustrative (no AI), a once/monthly toggle, a review step that collects no card details ("Demo: no payment is processed"), and a thank-you.

**Staff:** `/[locale]/staff` signs in with the passcode, then shows saved questions (with a soft-tombstone delete) and the usage summary with derived cost and the `complete` flag, then signs out. `503` shows a fail-closed message. Fetches use `cache: "no-store"`; the server already sends `private, no-store`. The old `/staff/gaps` redirects here.

**Language:** `[locale]` routes and all copy in the dictionaries (Spanish with "tú"). The language switch is a **full page load**, because it swaps `<html lang>`, and a client re-render of the root layout warned about the theme script and dropped the saved theme.

**Footer:** "Lumi is a fictional foundation. Demo content. Not medical advice." It also holds the **only** non-safety phone number on the site, a fictional `555-0142` in `footer.contactPhone`, enforced by the dictionary tests (ADR 0012).

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

## Alternatives
- **A component library (shadcn/Radix).** Rejected: it brings the template look we're avoiding, and a few utilities were enough.
- **Persisting the conversation in `localStorage`.** Rejected: ADR 0005 promises that each tab is a fresh conversation, and a shared phone would keep a parent's questions. The notebook is the explicit, controllable place to keep things.
- **Server-rendered theme from a cookie.** Rejected: it would make every page dynamic, for a cosmetic preference.
- **Real payment and sign-up integrations.** Out of scope for the brief, and they'd need real organisations.
