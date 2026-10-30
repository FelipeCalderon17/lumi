import { describe, expect, it } from "vitest";
import { clientIpFromForwardedFor, createRateLimiter, rateLimitKeyFor } from "./index";

describe("rateLimit.createRateLimiter", () => {
  it("allows up to `max` requests per window, then returns retryAfterMs", () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 2, maxKeys: 10 });
    expect(limiter.check("a", 0)).toEqual({ allowed: true });
    expect(limiter.check("a", 100)).toEqual({ allowed: true });
    expect(limiter.check("a", 400)).toEqual({ allowed: false, retryAfterMs: 600 });
    expect(limiter.check("b", 400)).toEqual({ allowed: true });
  });

  it("starts a new window once the old one has expired", () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1, maxKeys: 10 });
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 999).allowed).toBe(false);
    expect(limiter.check("a", 1_000).allowed).toBe(true);
  });

  it("expires entries after the window (sweep) so memory stays bounded", () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1, maxKeys: 3 });
    for (const key of ["a", "b", "c"]) limiter.check(key, 0);
    expect(limiter.size()).toBe(3);
    limiter.check("d", 2_000);
    expect(limiter.size()).toBe(1);
  });

  it("never tracks more than maxKeys keys, even when every window is live", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, maxKeys: 100 });
    for (let i = 0; i < 1_000; i++) limiter.check(`k${i}`, i);
    expect(limiter.size()).toBe(100);
  });
});

describe("rateLimit.rateLimitKeyFor", () => {
  it("hashes the IP with the salt and never returns it", () => {
    const key = rateLimitKeyFor("203.0.113.7", "salt");
    expect(key).not.toContain("203.0.113.7");
    expect(key).toBe(rateLimitKeyFor("203.0.113.7", "salt"));
    expect(key).not.toBe(rateLimitKeyFor("203.0.113.7", "other-salt"));
  });

  it("uses a shared bucket when the IP is unknown", () => {
    expect(rateLimitKeyFor(null, "salt")).toBe("unknown");
  });
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
