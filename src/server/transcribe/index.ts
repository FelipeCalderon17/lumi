import { NoTranscriptGeneratedError, transcribe } from "ai";
import { z } from "zod";
import { config, type ModelId } from "../config";
import { type RequestContext, stageSignal } from "../context";
import { type LedgerOutcome, recordCallsBestEffort, type UsageLedger } from "../ledger";
import { type Logger, silentLogger } from "../log";
import { failureFromError, now, type TranscriptionModelV4 } from "../models";
import type { RateLimiter } from "../rate-limit";
import type { FailureReason, Language, ModelCall } from "../types";
import { LANGUAGES } from "../types";

/**
 * Voice → text (ADR 0014). The parent records a note or a question; we return text only, and
 * the UI lets them edit it before it's used anywhere.
 *
 * Audio is held in memory for the length of one request: never written to disk, never stored,
 * never logged. Limits are enforced in three places, because the server can't trust the client:
 *   1. bytes: the body read stops at config.limits.audio.maxBytes (sized for 2 minutes);
 *   2. declared length: the client sends the recording's duration; over 2 minutes is refused
 *      before any model call;
 *   3. measured length: the provider's own duration is the only trusted one. If it reports
 *      more than 2 minutes, or reports no duration at all, the text is discarded (controlled
 *      failure). The client's duration is a pre-check only, never a substitute.
 */

export const TranscribeQuerySchema = z.object({
  /** Page locale, for fixed messages only. The model detects the spoken language itself. */
  locale: z.enum(LANGUAGES).default("en"),
  /** Recording length as measured by the client (untrusted). */
  durationMs: z.coerce.number().int().positive().optional(),
});

export type AudioCheck =
  | { ok: true; mediaType: string }
  | { ok: false; reason: "empty" | "unsupported_type" | "not_audio" | "too_long" };

const TOLERANCE_SECONDS = 2;

/** `audio/webm;codecs=opus` → `audio/webm`. */
export function baseMediaType(contentType: string | null): string {
  return (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

function looksLikeContainer(bytes: Uint8Array, mediaType: string): boolean {
  if (mediaType === "audio/webm") {
    return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  // MP4 / M4A: an ISO-BMFF box whose type at offset 4 is "ftyp".
  return String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp";
}

/** Checks before any model call: type allowlist, container signature, declared length. */
export function checkAudio(
  bytes: Uint8Array,
  contentType: string | null,
  declaredDurationMs?: number,
): AudioCheck {
  const mediaType = baseMediaType(contentType);
  if (!(config.limits.audio.mediaTypes as readonly string[]).includes(mediaType)) {
    return { ok: false, reason: "unsupported_type" };
  }
  if (bytes.byteLength === 0) return { ok: false, reason: "empty" };
  if (bytes.byteLength < 8 || !looksLikeContainer(bytes, mediaType)) {
    return { ok: false, reason: "not_audio" };
  }
  if (
    declaredDurationMs !== undefined &&
    declaredDurationMs > config.limits.audio.maxSeconds * 1_000
  ) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, mediaType };
}

/** OpenAI's transcription `usage`: tokens for some models, duration for others. */
const TranscriptionUsageSchema = z.union([
  z.object({
    type: z.literal("tokens"),
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal("duration"), seconds: z.number().nonnegative() }),
]);

/**
 * `transcribe()` doesn't expose the provider's `usage`, so we pass the call through a thin
 * wrapper that keeps a copy of it. Nothing else changes.
 */
function capturingUsage(model: TranscriptionModelV4) {
  let usage: unknown;
  const wrapped: TranscriptionModelV4 = {
    specificationVersion: model.specificationVersion,
    provider: model.provider,
    modelId: model.modelId,
    doGenerate: async (options) => {
      const result = await model.doGenerate(options);
      usage = result.usage;
      return result;
    },
  };
  return { model: wrapped, usage: () => usage };
}

export type Transcript = { text: string; language: Language | null; audioSeconds: number | null };

export type TranscribeResult =
  | { status: "ok"; text: string; language: Language | null }
  /** Silence or nothing intelligible. */
  | { status: "empty" }
  | { status: "too_long" }
  | { status: "failed"; reason: FailureReason };

export type TranscribeDeps = {
  model: TranscriptionModelV4;
  modelId?: ModelId;
  timeoutMs?: number;
};

function toLanguage(code: string | undefined): Language | null {
  const lower = (code ?? "").toLowerCase();
  if (lower.startsWith("es") || lower === "spanish") return "es";
  if (lower.startsWith("en") || lower === "english") return "en";
  return null;
}

/**
 * One transcription call. Returns the outcome for the client and, separately, the call facts
 * for the ledger (audio seconds and tokens when the provider reports them). Never returns the
 * audio, and the text only on success.
 */
export async function transcribeAudio(
  audio: Uint8Array,
  ctx: RequestContext,
  deps: TranscribeDeps,
): Promise<{ result: TranscribeResult; call: ModelCall | null }> {
  if (ctx.signal.aborted) return { result: { status: "failed", reason: "cancelled" }, call: null };
  const modelId = deps.modelId ?? config.models.transcribe;
  const signal = stageSignal(ctx, deps.timeoutMs ?? config.timeouts.transcribeMs);
  const capture = capturingUsage(deps.model);
  const started = now();
  const call = (
    audioSeconds: number | null,
    tokens: { input: number; output: number } | null,
    ok: boolean,
  ): ModelCall => ({
    step: "transcribe",
    model: modelId,
    inputTokens: tokens?.input ?? null,
    cachedInputTokens: tokens ? 0 : null,
    outputTokens: tokens?.output ?? null,
    reasoningTokens: null,
    audioSeconds,
    latencyMs: Math.round(now() - started),
    finishReason: ok ? "stop" : "none",
  });

  try {
    const transcript = await transcribe({
      model: capture.model,
      audio,
      maxRetries: config.retry.maxRetries,
      abortSignal: signal,
    });
    const usage = TranscriptionUsageSchema.safeParse(capture.usage());
    const audioSeconds =
      transcript.durationInSeconds ??
      (usage.success && usage.data.type === "duration" ? usage.data.seconds : null);
    const tokens =
      usage.success && usage.data.type === "tokens"
        ? { input: usage.data.input_tokens, output: usage.data.output_tokens }
        : null;
    const facts = call(audioSeconds, tokens, true);

    // No trusted duration → we can't verify the limit, so the text isn't used. The ledger
    // still records the call, with audioSeconds null (unknown).
    if (audioSeconds === null) {
      return { result: { status: "failed", reason: "unverified_duration" }, call: facts };
    }
    if (audioSeconds > config.limits.audio.maxSeconds + TOLERANCE_SECONDS) {
      return { result: { status: "too_long" }, call: facts };
    }
    const text = transcript.text.trim();
    if (text === "") return { result: { status: "empty" }, call: facts };
    return {
      result: { status: "ok", text, language: toLanguage(transcript.language) },
      call: facts,
    };
  } catch (error) {
    // The SDK throws when the provider answered with no text at all (silence): that's "empty",
    // not a failure, and the provider did bill for it.
    if (NoTranscriptGeneratedError.isInstance(error) && !signal.aborted) {
      return { result: { status: "empty" }, call: call(null, null, true) };
    }
    return {
      result: { status: "failed", reason: failureFromError(signal) },
      call: call(null, null, false),
    };
  }
}

export type TranscribeResponse =
  | TranscribeResult
  | { status: "rate_limited" | "capacity" }
  | { error: "unsupported_type" | "not_audio" | "empty" | "too_long" };

export type TranscriptionServiceDeps = TranscribeDeps & {
  limiters: { transcribe: RateLimiter; modelCalls: RateLimiter };
  ledger: UsageLedger;
  log?: Logger;
  ledgerWriteMs?: number;
};

/**
 * Everything after the bounded body read: checks → per-client limit → instance ceiling →
 * transcription → ledger. `recorded` settles when the best-effort ledger write is done; the
 * route doesn't wait for it.
 */
export async function handleTranscription(
  input: { audio: Uint8Array; contentType: string | null; durationMs?: number },
  ctx: RequestContext,
  deps: TranscriptionServiceDeps,
): Promise<{ httpStatus: number; body: TranscribeResponse; recorded: Promise<unknown> }> {
  const done = (httpStatus: number, body: TranscribeResponse) => ({
    httpStatus,
    body,
    recorded: Promise.resolve(),
  });
  const check = checkAudio(input.audio, input.contentType, input.durationMs);
  if (!check.ok)
    return done(check.reason === "unsupported_type" ? 415 : 400, { error: check.reason });
  if (!deps.limiters.transcribe.check(ctx.rateLimitKey).allowed) {
    return done(200, { status: "rate_limited" });
  }
  if (!deps.limiters.modelCalls.check("instance").allowed) return done(200, { status: "capacity" });

  const { result, call } = await transcribeAudio(input.audio, ctx, deps);
  const outcome: LedgerOutcome = ctx.signal.aborted
    ? "cancelled"
    : result.status === "ok"
      ? "transcribed"
      : "fallback";
  (deps.log ?? silentLogger)({
    requestId: ctx.requestId,
    event: "transcribe",
    outcome: result.status,
  });
  const recorded = call
    ? recordCallsBestEffort(
        deps.ledger,
        [{ call, failureReason: result.status === "failed" ? result.reason : null }],
        { requestId: ctx.requestId, outcome },
        deps.ledgerWriteMs ?? config.timeouts.ledgerWriteMs,
      )
    : Promise.resolve();
  return { httpStatus: 200, body: result, recorded };
}
