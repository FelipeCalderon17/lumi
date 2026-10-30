import { describe, expect, it } from "vitest";
import {
  checkStaffSession,
  issueSessionToken,
  passcodeMatches,
  readStaffAuthConfig,
  verifySessionToken,
} from "./index";

const secret = "s".repeat(32);
const env = { STAFF_PASSCODE: "lumi-demo-code", STAFF_SESSION_SECRET: secret };

describe("staffAuth.readStaffAuthConfig", () => {
  it("is enabled with a passcode and a long enough secret", () => {
    expect(readStaffAuthConfig(env)).toEqual({
      enabled: true,
      passcode: "lumi-demo-code",
      sessionSecret: secret,
    });
  });

  it("fails closed when STAFF_PASSCODE is missing", () => {
    expect(readStaffAuthConfig({ ...env, STAFF_PASSCODE: undefined })).toEqual({
      enabled: false,
      reason: "missing_passcode",
    });
    expect(readStaffAuthConfig({ ...env, STAFF_PASSCODE: "  " }).enabled).toBe(false);
  });

  it("fails closed when STAFF_SESSION_SECRET is missing or shorter than minSecretLength", () => {
    for (const STAFF_SESSION_SECRET of [undefined, "", "short"]) {
      expect(readStaffAuthConfig({ ...env, STAFF_SESSION_SECRET })).toEqual({
        enabled: false,
        reason: "missing_or_weak_secret",
      });
    }
  });
});

describe("staffAuth.passcodeMatches", () => {
  it("matches only the exact passcode, whatever the length", () => {
    expect(passcodeMatches("lumi-demo-code", "lumi-demo-code")).toBe(true);
    expect(passcodeMatches("lumi-demo-cod", "lumi-demo-code")).toBe(false);
    expect(passcodeMatches("", "lumi-demo-code")).toBe(false);
  });
});

describe("staffAuth session tokens", () => {
  const now = 1_800_000_000_000;

  it("issues a token that verifies until it expires, then is rejected", () => {
    const token = issueSessionToken(secret, now, 1_000);
    expect(verifySessionToken(token, secret, now + 999)).toBe(true);
    expect(verifySessionToken(token, secret, now + 1_000)).toBe(false);
  });

  it("rejects a token with a tampered expiry or signature, or another secret", () => {
    const token = issueSessionToken(secret, now, 1_000);
    const [expires = "", signature = ""] = token.split(".");
    expect(verifySessionToken(`${Number(expires) + 10_000}.${signature}`, secret, now)).toBe(false);
    const flipped = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    expect(verifySessionToken(`${expires}.${flipped}`, secret, now)).toBe(false);
    expect(verifySessionToken(token, "t".repeat(32), now)).toBe(false);
    expect(verifySessionToken("garbage", secret, now)).toBe(false);
    expect(verifySessionToken(undefined, secret, now)).toBe(false);
  });

  it("the token never contains the passcode", () => {
    expect(issueSessionToken(secret, now, 1_000)).not.toContain(env.STAFF_PASSCODE);
  });
});

describe("staffAuth.checkStaffSession", () => {
  it("refuses everything with 503 when staff auth is disabled, even a valid-looking token", () => {
    const token = issueSessionToken(secret, Date.now(), 60_000);
    expect(checkStaffSession(readStaffAuthConfig({}), token)).toEqual({
      ok: false,
      status: 503,
      error: "staff_disabled",
    });
  });

  it("401 without a valid session, ok with one", () => {
    const auth = readStaffAuthConfig(env);
    expect(checkStaffSession(auth, undefined)).toMatchObject({ ok: false, status: 401 });
    expect(checkStaffSession(auth, issueSessionToken(secret, Date.now(), 60_000))).toEqual({
      ok: true,
    });
  });
});
