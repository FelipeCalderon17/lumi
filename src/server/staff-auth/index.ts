import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config";

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

export function readStaffAuthConfig(env: Record<string, string | undefined>): StaffAuthConfig {
  const passcode = env.STAFF_PASSCODE?.trim() ?? "";
  const sessionSecret = env.STAFF_SESSION_SECRET?.trim() ?? "";
  if (passcode === "") return { enabled: false, reason: "missing_passcode" };
  if (sessionSecret.length < config.staff.minSecretLength) {
    return { enabled: false, reason: "missing_or_weak_secret" };
  }
  return { enabled: true, passcode, sessionSecret };
}

/** Constant-time comparison of any two strings (hashing first makes the lengths equal). */
export function passcodeMatches(submitted: string, expected: string): boolean {
  const a = createHash("sha256").update(submitted).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function sign(secret: string, expiresAtMs: number): string {
  return createHmac("sha256", secret).update(String(expiresAtMs)).digest("base64url");
}

export function issueSessionToken(secret: string, nowMs: number, ttlMs: number): string {
  const expiresAtMs = nowMs + ttlMs;
  return `${expiresAtMs}.${sign(secret, expiresAtMs)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  nowMs: number,
): boolean {
  if (!token) return false;
  const match = /^(\d{1,16})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;
  const [, expiresRaw = "", signature = ""] = match;
  const expiresAtMs = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= nowMs) return false;
  const expected = Buffer.from(sign(secret, expiresAtMs));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type StaffSessionCheck =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: "unauthorized" | "staff_disabled" };

/** The one check every staff route runs first. Disabled config → 503, always. */
export function checkStaffSession(
  auth: StaffAuthConfig,
  token: string | undefined,
  nowMs: number = Date.now(),
): StaffSessionCheck {
  if (!auth.enabled) return { ok: false, status: 503, error: "staff_disabled" };
  if (!verifySessionToken(token, auth.sessionSecret, nowMs)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}
