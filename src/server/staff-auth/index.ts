import { NotImplementedError } from "../types";

/**
 * Staff access to the gaps view (ADR 0008).
 *
 * - Login compares the submitted passcode with STAFF_PASSCODE in constant time, throttled by
 *   config.rateLimit.staffLogin.
 * - On success the server issues an expiring session token `<expiresAtMs>.<hmac>` signed with
 *   STAFF_SESSION_SECRET (HMAC-SHA256). The passcode itself is never put in the cookie.
 * - Cookie: httpOnly, secure, sameSite=strict, path=/, maxAge = config.staff.sessionTtlMs.
 * - EVERY staff page and API request verifies the token; responses are
 *   `Cache-Control: private, no-store`.
 * - Fail closed: if STAFF_PASSCODE or STAFF_SESSION_SECRET is missing (or the secret is shorter
 *   than config.staff.minSecretLength), every login and every staff request is refused.
 */

export type StaffAuthConfig =
  | { enabled: true; passcode: string; sessionSecret: string }
  | { enabled: false; reason: "missing_passcode" | "missing_or_weak_secret" };

export function readStaffAuthConfig(_env: Record<string, string | undefined>): StaffAuthConfig {
  // TODO(phase-3)
  throw new NotImplementedError("staffAuth.readStaffAuthConfig");
}

export function issueSessionToken(_secret: string, _nowMs: number, _ttlMs: number): string {
  // TODO(phase-3)
  throw new NotImplementedError("staffAuth.issueSessionToken");
}

export function verifySessionToken(
  _token: string | undefined,
  _secret: string,
  _nowMs: number,
): boolean {
  // TODO(phase-3): parse, check expiry, timingSafeEqual on the HMAC.
  throw new NotImplementedError("staffAuth.verifySessionToken");
}
