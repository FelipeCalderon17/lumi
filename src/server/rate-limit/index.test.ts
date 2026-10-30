import { describe, expect, it } from "vitest";
import { NotImplementedError } from "../types";
import { clientIpFromForwardedFor, createRateLimiter } from "./index";

describe("rateLimit.createRateLimiter (contract)", () => {
  it("is a stub until Phase 2", () => {
    expect(() => createRateLimiter({ windowMs: 1000, max: 1, maxKeys: 10 })).toThrow(
      NotImplementedError,
    );
  });

  it.todo("allows up to `max` requests per window, then returns retryAfterMs");
  it.todo("expires entries after the window (sweep) so memory stays bounded");
  it.todo("never tracks more than maxKeys keys");
});

describe("rateLimit.clientIpFromForwardedFor", () => {
  it("takes the right-most entry appended by the trusted proxy", () => {
    expect(clientIpFromForwardedFor("203.0.113.7", 1)).toBe("203.0.113.7");
    expect(clientIpFromForwardedFor(" 203.0.113.7 , 198.51.100.2 ", 1)).toBe("198.51.100.2");
  });

  it("ignores client-supplied entries to the left (spoofing)", () => {
    expect(clientIpFromForwardedFor("1.1.1.1, 2.2.2.2, 198.51.100.2", 1)).toBe("198.51.100.2");
  });

  it("supports more than one trusted hop", () => {
    expect(clientIpFromForwardedFor("1.1.1.1, 198.51.100.2, 10.0.0.1", 2)).toBe("198.51.100.2");
  });

  it("returns null when the header is missing or too short", () => {
    expect(clientIpFromForwardedFor(null, 1)).toBeNull();
    expect(clientIpFromForwardedFor("", 1)).toBeNull();
    expect(clientIpFromForwardedFor("198.51.100.2", 2)).toBeNull();
  });
});
