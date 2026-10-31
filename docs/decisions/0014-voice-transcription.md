# 0014 — Voice to text with `gpt-transcribe`, text only, never stored

**Status:** Accepted · 2026-10-30 · *Phase 2. Model choice to be confirmed by Felipe with a live EN/ES check.*

## Context
Parents often have their hands full, or find it easier to say a worry out loud than to type it at 2 a.m. Voice input helps for chat questions and for notebook notes. Audio is more sensitive than text (a voice identifies a person, and background speech can include other people), so the design has to keep it short-lived.

## Decision
- `POST /api/transcribe` takes the raw recording (`audio/webm`, `audio/mp4`, `audio/m4a`), transcribes it with OpenAI through the AI SDK's `transcribe()` and returns **text only**. The UI shows the text in an editable field, and nothing is sent anywhere until the parent chooses to.
- **Model: `gpt-transcribe`** (`config.models.transcribe`). Checked against the installed `@ai-sdk/openai@4.0.106` types and docs, which list `whisper-1`, `gpt-4o-mini-transcribe` (+ dated snapshots), `gpt-4o-transcribe`, `gpt-4o-transcribe-diarize`, `gpt-transcribe`, and two streaming-only ids (`gpt-live-transcribe`, `gpt-realtime-whisper`). Why `gpt-transcribe`:
  - It's the newest general REST transcription model in the provider, and the only non-diarize model there that also **returns the detected language**. We don't force a language hint, because bilingual families switch between English and Spanish, and a wrong hint hurts accuracy more than detection does.
  - It reports the **billed duration** in `usage` (it's duration-billed), so the ledger gets `audio_seconds` from the provider rather than from the client.
  - It supports streaming transcription in the same SDK, if we later want live captions.
  - `gpt-4o-transcribe` is the fallback choice if the live check shows worse Spanish. `whisper-1` is older and weaker on noisy phone audio. Diarization isn't needed for one speaker.
  - Price: $0.0045 per audio minute (OpenAI launch pages + public pricing trackers, applied 2026-10-30).
- **Limits** (`config.limits.audio`):
  - **Max 2 minutes.** The server can't trust the client, so it checks three times: the body read stops at `maxBytes` (4 MB, about 2 minutes at 256 kbps); a declared `durationMs` over 2 minutes is refused before any model call; and if the provider measures more than 2 minutes (+2 s tolerance), **or reports no duration at all**, the text is discarded (`failed`, reason `unverified_duration`; the ledger keeps the call with `audio_seconds` null). Every reported duration (`duration`, billed usage `seconds`) must be a finite number above 0 (else `invalid_duration`) and they must agree within `durationAgreementSeconds` (else `inconsistent_duration`); the largest is the one checked. In both cases the ledger gets `audio_seconds` null and the reason, never the untrusted number (added after Codex re-review 3). Only the provider's duration is trusted; the client's is a pre-check.
  - Media type allowlist plus a container signature check (WebM EBML header, MP4 `ftyp` box), so arbitrary files aren't forwarded.
  - Its own rate limit (`config.rateLimit.transcribe`, 30/hour per client) plus the instance-wide model-call ceiling.
- **Privacy:** audio is held in memory for one request. It's never written to disk, stored or logged. AI SDK telemetry stays off. The ledger records numbers only: `audio_seconds`, tokens when the provider reports them, latency, outcome.
- **Safety:** transcribed text goes back to the parent, not into a model. When they send it as a chat question or a notebook note, the normal safety pre-check runs on it.

## Consequences
- Voice is a convenience, not a separate path: same safety checks, same limits on what reaches the model.
- One more paid call type. It's capped per client and per instance, and its cost is visible in the staff view once the price is known.
- The 2-minute limit cuts off long voice memos. That's on purpose: a short note is easier to edit and safer to send.
- `durationMs` is client-reported. A client that lies can still only send `maxBytes`, and the provider's measured duration catches the rest. If a provider or model change ever stops reporting duration, every transcription fails closed until that's fixed (visible in the ledger as `unverified_duration`).

## Known limitations
*Added 2026-10-30 (Phase 2 final fixes), so the README tradeoffs table has a source.*
- **The live check is pending.** The model was chosen from the provider's docs and types. The only live run so far is two short synthetic recordings (macOS `say`, one EN and one ES) in `pnpm smoke`. Both came back word for word with the language detected. Real voices, accents, noisy hospital rooms and Spanish quality aren't verified. Felipe confirms the model (or switches to `gpt-4o-transcribe`) with a live EN/ES check on real recordings.

- **Browser support (Phase 3, [ADR 0016](0016-phase-3-ui.md)).** The mic is offered only where `MediaRecorder` and `getUserMedia` exist and the browser records webm/opus, webm or mp4. Elsewhere it's hidden and typing works as usual. Recording is at 32 kbps, with a visible countdown from 2:00 and an auto-stop at the cap. The declared duration is capped at 120 s. Permission denied, empty, too long, busy and failed each have a calm message. The audio lives in memory until the single upload, then it's dropped. Checked headless: unsupported, denied, countdown and auto-stop (with a fast-forwarded clock and a mocked upload). One real upload was Chrome's synthetic tone, which correctly came back `empty`.

## Alternatives
- **Browser speech recognition (Web Speech API).** Free and on-device in some browsers, but quality varies, Spanish support is uneven, and in Chrome the audio goes to Google, which is worse to explain.
- **Streaming transcription (`gpt-live-transcribe`).** Nicer UX, but needs a WebSocket path and more moving parts than a 2-minute note needs.
- **Store audio for quality review.** Rejected: against ADR 0005, and not needed.
