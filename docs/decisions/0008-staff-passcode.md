# 0008 — Staff gaps view behind a shared passcode and a signed session

**Status:** Accepted · 2026-10-30 · *Revised 2026-10-30 after Codex review 1: HMAC session token instead of the passcode in the cookie, fail closed, throttled login, every request authenticated, no-store.*

## Context
`/[locale]/staff/gaps` lists consented unanswered questions. It must not be public, but building accounts is out of scope.

## Decision
- **Login.** Staff enter a shared passcode (`STAFF_PASSCODE`). The server compares it in constant time. Login attempts are throttled per client (`config.rateLimit.staffLogin`, 5 per 15 minutes).
- **Session.** On success the server issues `<expiresAtMs>.<HMAC-SHA256(expiresAtMs)>`, signed with `STAFF_SESSION_SECRET` (separate from the passcode, ≥ 32 characters). Expiry is `config.staff.sessionTtlMs` (8 hours). **The passcode is never stored in the cookie.** Cookie: `httpOnly`, `secure`, `sameSite=strict`, `path=/`.
- **Every request is authenticated.** The staff page and every staff API call verify the token (expiry + `timingSafeEqual` on the signature). There's no "checked once at login" path.
- **No caching.** Staff responses send `Cache-Control: private, no-store`. The page is `noindex`.
- **Fail closed.** If `STAFF_PASSCODE` or `STAFF_SESSION_SECRET` is missing, or the secret is too short, the staff area refuses every login and every request.

## Consequences
- Simple to run and demo; a stolen cookie expires within hours and doesn't reveal the passcode.
- A low-entropy passcode can't be brute-forced offline from a captured cookie, because the signing secret is separate.
- Rotating `STAFF_SESSION_SECRET` logs everyone out. Rotating the passcode doesn't end existing sessions. Both are acceptable at this size.
- Still no per-person audit trail, and anyone with the code has full read access. Acceptable because the data is minimal and expires (ADR 0005).
- **Next:** real staff auth (SSO / magic links), roles and an audit log.

## Alternatives
- **No protection ("security by obscurity").** Rejected.
- **Passcode itself in the cookie.** Rejected (the original version): it leaks the credential and never expires.
- **Full auth (Auth.js, Clerk…).** Deferred: time is better spent on the assistant.
- **HTTP basic auth at the proxy.** Viable, but harder to style and to explain in the UI.
