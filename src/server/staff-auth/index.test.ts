import { describe, expect, it } from "vitest";
import { NotImplementedError } from "../types";
import { readStaffAuthConfig } from "./index";

describe("staffAuth (contract)", () => {
  it("is a stub until Phase 3", () => {
    expect(() => readStaffAuthConfig({})).toThrow(NotImplementedError);
  });

  it.todo("fails closed when STAFF_PASSCODE is missing");
  it.todo("fails closed when STAFF_SESSION_SECRET is missing or shorter than minSecretLength");
  it.todo("issues a token that verifies until it expires, then is rejected");
  it.todo("rejects a token with a tampered expiry or signature");
  it.todo("the token never contains the passcode");
});
