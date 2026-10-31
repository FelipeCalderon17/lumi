import { createHash } from "node:crypto";

/**
 * Fixed-window rate limits kept in memory, per instance (ADR 0006). One limiter per purpose:
 * chat, gap submissions, staff login, transcription, notebook, and an instance-wide
 * model-call ceiling (single key).
 * Expired windows are swept and the table is capped at `maxKeys`, so memory stays bounded.
 * Known limitation: limits reset on deploy and are not shared across replicas.
 * Keyed by a hash of the trusted client IP; the raw IP is never stored or logged.
 * The safety pre-check runs BEFORE any limiter: emergencies are never rate-limited.
 */

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

export interface RateLimiter {
  check(key: string, now?: number): RateLimitDecision;
  /** Number of keys currently tracked (for tests and bounded-memory checks). */
  size(): number;
}

type Window = { count: number; resetAt: number };

export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  maxKeys: number;
}): RateLimiter {
  const windows = new Map<string, Window>();

  function sweep(now: number) {
    for (const [key, window] of windows) if (window.resetAt <= now) windows.delete(key);
  }

  return {
    check(key, now = Date.now()) {
      let window = windows.get(key);
      if (window && window.resetAt <= now) {
        windows.delete(key);
        window = undefined;
      }
      if (!window) {
        if (windows.size >= opts.maxKeys) sweep(now);
        // Still full of live windows: evict the oldest (Map keeps insertion order). That client
        // gets a fresh window early, a small leak we accept to keep memory bounded. The
        // instance-wide ceiling still caps total model calls.
        if (windows.size >= opts.maxKeys) {
          const oldest = windows.keys().next().value;
          if (oldest !== undefined) windows.delete(oldest);
        }
        window = { count: 0, resetAt: now + opts.windowMs };
        windows.set(key, window);
      }
      if (window.count >= opts.max) return { allowed: false, retryAfterMs: window.resetAt - now };
      window.count += 1;
      return { allowed: true };
    },
    size: () => windows.size,
  };
}

/**
 * The client IP as seen by our trusted proxies: the entry `trustedHops` from the right of
 * X-Forwarded-For. Anything further left could have been supplied by the client (spoofable).
 * On Railway the app receives `client, edge-egress`, so `trustedHops = 2` (see config). Returns
 * null if the header is missing or has fewer entries than trusted hops; callers then use a
 * shared "unknown" bucket.
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

/**
 * Rate-limit key: a salted SHA-256 of the trusted IP, or a shared "unknown" bucket.
 * The salt is per process (random at boot), so keys can't be reversed from a memory dump
 * with a precomputed table, and nothing is persisted.
 */
export function rateLimitKeyFor(ip: string | null, salt: string): string {
  if (ip === null) return "unknown";
  return createHash("sha256").update(salt).update(ip).digest("base64url").slice(0, 22);
}
