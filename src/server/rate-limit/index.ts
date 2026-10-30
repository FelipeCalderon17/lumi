import { NotImplementedError } from "../types";

/**
 * Fixed-window rate limits kept in memory, per instance (ADR 0006). One limiter per purpose:
 * chat, gap submissions, staff login, and an instance-wide model-call ceiling (single key).
 * Expired windows are swept and the table is capped at `maxKeys`, so memory stays bounded.
 * Known limitation: limits reset on deploy and are not shared across replicas.
 * Keyed by a hash of the trusted client IP; the raw IP is never stored or logged.
 * The safety pre-check runs BEFORE any limiter: emergencies are never rate-limited.
 */

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

export interface RateLimiter {
  check(key: string, now?: number): RateLimitDecision;
}

export function createRateLimiter(_opts: {
  windowMs: number;
  max: number;
  maxKeys: number;
}): RateLimiter {
  // TODO(phase-2)
  throw new NotImplementedError("rateLimit.createRateLimiter");
}

/**
 * The client IP as seen by our trusted proxy. Railway's edge appends the peer address to
 * X-Forwarded-For, so with `trustedHops = 1` the right-most entry is the client and anything
 * to its left was supplied by the client (spoofable). Returns null if the header is missing or
 * has fewer entries than trusted hops; callers then use a shared "unknown" bucket.
 */
export function clientIpFromForwardedFor(
  header: string | null,
  trustedHops: number,
): string | null {
  if (!header || trustedHops < 1) return null;
  const hops = header
    .split(",")
    .map((hop) => hop.trim())
    .filter((hop) => hop !== "");
  return hops[hops.length - trustedHops] ?? null;
}
