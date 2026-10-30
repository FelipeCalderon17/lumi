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
  /** Transcription: the provider reported no duration, so the 2-minute limit can't be verified. */
  | "unverified_duration"
  /** finishReason "length": the answer was cut off by maxOutputTokens. Never shown. */
  | "truncated"
  /** finishReason "interrupted" / "error" / "other", or a stream that ended without a finish. */
  | "interrupted"
  /** Per-client limit. */
  | "rate_limited"
  /** Instance-wide model-call ceiling. */
  | "capacity"
  /** The client went away (request signal aborted). Nothing is sent; recorded in the ledger. */
  | "cancelled"
  /** A bug on our side (an unexpected exception). Still ends in the calm fallback. */
  | "internal";

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

export const MODEL_STEPS = ["router", "answer", "transcribe", "notebook", "judge"] as const;
export type ModelStepName = (typeof MODEL_STEPS)[number];

/**
 * Metadata for ONE model call, kept apart from the business outcome so it can be recorded
 * for successes and failures alike. These are FACTS from the provider: token counts and
 * audio duration. No cost: cost is derived when the ledger is read (ADR 0013).
 * Unknown numbers are `null`, never 0.
 */
export type ModelCall = {
  step: ModelStepName;
  model: ModelId;
  /** Total input tokens, cached ones included. */
  inputTokens: number | null;
  /** The part of inputTokens served from the provider's prompt cache. */
  cachedInputTokens: number | null;
  /** Total output tokens, reasoning tokens included (that's how they're billed). */
  outputTokens: number | null;
  /** The part of outputTokens spent on reasoning. */
  reasoningTokens: number | null;
  /** Transcription only: billed audio duration. `null` for text steps or when unknown. */
  audioSeconds: number | null;
  latencyMs: number;
  finishReason: FinishReason;
};

/** What every model-backed step returns: the business result and, separately, the call. */
export type ModelStep<T> = {
  result: StepResult<T>;
  /** `null` only if no request reached the provider (e.g. aborted before sending). */
  call: ModelCall | null;
};
