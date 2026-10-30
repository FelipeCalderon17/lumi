# 0008 — Staff gaps view behind a shared passcode

**Status:** Accepted · 2026-10-30

## Context
`/[locale]/staff/gaps` lists consented unanswered questions. It must not be public, but building accounts is out of scope.

## Decision
Protect the view (and its API) with a single shared passcode from `STAFF_PASSCODE`. It's compared in constant time on the server and stored in an httpOnly, secure, same-site cookie after entry. The page is `noindex`.

## Consequences
- Simple to run and demo.
- No per-person audit trail, no revocation except rotating the passcode, and anyone with the code has full read access. Acceptable because the data is already minimal (ADR 0005).
- **Next:** real staff auth (SSO / magic links), roles, and an audit log.

## Alternatives
- **No protection ("security by obscurity").** Rejected.
- **Full auth (Auth.js, Clerk…).** Deferred: time better spent on the assistant.
- **HTTP basic auth at the proxy.** Viable, but harder to style and to explain in the UI.
