/**
 * Shared types for the server pipeline. Everything under `src/server` is
 * framework-free TypeScript: no imports from `next`, `react` or `src/app`.
 */
import type { ModelId } from "./config";

export const LANGUAGES = ["en", "es"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Why a step could not produce a usable result. Every one of these ends in a calm fallback. */
export type FailureReason =
  | "timeout"
  | "provider_error"
  | "invalid_output"
  /** finishReason "length": the answer was cut off by maxOutputTokens. Never shown. */
  | "truncated"
  /** finishReason "interrupted" / "error" / "other", or a stream that ended without a finish. */
  | "interrupted"
  /** Per-client limit. */
  | "rate_limited"
  /** Instance-wide model-call ceiling. */
  | "capacity"
  /** The client went away (request signal aborted). Nothing is sent; recorded in the ledger. */
  | "cancelled";

export type StepResult<T> = { ok: true; value: T } | { ok: false; reason: FailureReason };

/** AI SDK finish reasons, plus "none" when the call failed before finishing. */
export type FinishReason =
  | "stop"
  | "length"
  | "content-filter"
  | "tool-calls"
  | "error"
  | "interrupted"
  | "other"
  | "none";

/**
 * Metadata for ONE model call, kept apart from the business outcome so it can be recorded
 * for successes and failures alike. Unknown numbers are `null`, never 0.
 */
export type ModelCall = {
  stage: "router" | "answer" | "judge";
  model: ModelId;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  /** `null` when any token count or price is unknown. */
  estimatedCostUsd: number | null;
  finishReason: FinishReason;
};

/** What every model-backed step returns: the business result and, separately, the call. */
export type ModelStep<T> = {
  result: StepResult<T>;
  /** `null` only if no request reached the provider (e.g. aborted before sending). */
  call: ModelCall | null;
};

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet`);
    this.name = "NotImplementedError";
  }
}
