/**
 * Shared types for the server pipeline. Everything under `src/server` is
 * framework-free TypeScript: no imports from `next`, `react` or `src/app`.
 */

export const LANGUAGES = ["en", "es"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Why a model-backed step could not produce a usable result. */
export type FailureReason = "timeout" | "provider_error" | "invalid_output" | "rate_limited";

export type StepResult<T> = { ok: true; value: T } | { ok: false; reason: FailureReason };

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet`);
    this.name = "NotImplementedError";
  }
}
