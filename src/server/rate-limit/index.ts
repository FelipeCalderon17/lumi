import { NotImplementedError } from "../types";

/**
 * Fixed-window rate limit kept in memory, per instance (ADR 0006).
 * Known limitation: limits reset on deploy and are not shared across replicas.
 * Keyed by a hash of the client IP; the raw IP is never stored or logged.
 */

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

export interface RateLimiter {
  check(key: string, now?: number): RateLimitDecision;
}

export function createRateLimiter(_opts: { windowMs: number; max: number }): RateLimiter {
  // TODO(phase-1)
  throw new NotImplementedError("rateLimit.createRateLimiter");
}
