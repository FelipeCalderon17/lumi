import { MockTranscriptionModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { config } from "../config";
import type { UsageEntry } from "../ledger";
import { createRateLimiter } from "../rate-limit";
import { testCtx } from "../test-helpers";
import {
  baseMediaType,
  checkAudio,
  handleTranscription,
  TranscribeQuerySchema,
  transcribeAudio,
} from "./index";

const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6]);
const MP4 = new Uint8Array([0, 0, 0, 0x20, ...new TextEncoder().encode("ftypM4A "), 0, 0]);

function model(
  result: Partial<{
    text: string;
    language: string;
    durationInSeconds: number;
    usage: unknown;
  }> = {},
) {
  return new MockTranscriptionModelV4({
    doGenerate: async () => ({
      text: result.text ?? "Ask about parking",
      segments: [],
      language: result.language ?? "en",
      durationInSeconds: result.durationInSeconds,
      warnings: [],
      ...(result.usage ? { usage: result.usage as Record<string, never> } : {}),
      response: { timestamp: new Date(), modelId: "gpt-transcribe" },
    }),
  });
}

describe("transcribe.checkAudio (before any model call)", () => {
  it("accepts webm, mp4 and m4a with a matching container signature", () => {
    expect(checkAudio(WEBM, "audio/webm;codecs=opus")).toEqual({
      ok: true,
      mediaType: "audio/webm",
    });
    expect(checkAudio(MP4, "audio/mp4")).toEqual({ ok: true, mediaType: "audio/mp4" });
    expect(checkAudio(MP4, "audio/x-m4a")).toEqual({ ok: true, mediaType: "audio/x-m4a" });
  });

  it("rejects other types, empty bodies and bytes that aren't the declared container", () => {
    expect(checkAudio(WEBM, "audio/wav")).toEqual({ ok: false, reason: "unsupported_type" });
    expect(checkAudio(WEBM, null)).toEqual({ ok: false, reason: "unsupported_type" });
    expect(checkAudio(new Uint8Array(), "audio/webm")).toEqual({ ok: false, reason: "empty" });
    expect(checkAudio(MP4, "audio/webm")).toEqual({ ok: false, reason: "not_audio" });
    expect(checkAudio(new TextEncoder().encode("<html>hello</html>"), "audio/mp4")).toEqual({
      ok: false,
      reason: "not_audio",
    });
  });

  it("refuses a declared length over 2 minutes", () => {
    expect(checkAudio(WEBM, "audio/webm", 120_000).ok).toBe(true);
    expect(checkAudio(WEBM, "audio/webm", 120_001)).toEqual({ ok: false, reason: "too_long" });
  });

  it("parses the query and the base media type", () => {
    expect(TranscribeQuerySchema.parse({ durationMs: "4500" })).toEqual({
      locale: "en",
      durationMs: 4500,
    });
    expect(TranscribeQuerySchema.safeParse({ locale: "fr" }).success).toBe(false);
    expect(baseMediaType(" Audio/WebM ; codecs=opus")).toBe("audio/webm");
  });
});

describe("transcribe.transcribeAudio (mocked model)", () => {
  it("returns the text, detected language and duration; tokens when reported", async () => {
    const { result, call } = await transcribeAudio(WEBM, testCtx(), {
      model: model({
        text: " ¿Dónde estaciono? ",
        language: "es",
        durationInSeconds: 4.2,
        usage: { type: "tokens", input_tokens: 70, output_tokens: 8 },
      }),
    });
    expect(result).toEqual({ status: "ok", text: "¿Dónde estaciono?", language: "es" });
    expect(call).toMatchObject({
      step: "transcribe",
      model: "gpt-transcribe",
      audioSeconds: 4.2,
      inputTokens: 70,
      outputTokens: 8,
      reasoningTokens: null,
    });
  });

  it("reads duration from duration-billed usage; unknown tokens stay null", async () => {
    const { call } = await transcribeAudio(WEBM, testCtx(), {
      model: model({ usage: { type: "duration", seconds: 9 } }),
    });
    expect(call).toMatchObject({ audioSeconds: 9, inputTokens: null, outputTokens: null });
  });

  it("unknown duration and usage → null, never 0", async () => {
    const { call } = await transcribeAudio(WEBM, testCtx(), { model: model() });
    expect(call).toMatchObject({ audioSeconds: null, inputTokens: null, cachedInputTokens: null });
  });

  it("discards the text when the provider measures more than 2 minutes", async () => {
    const { result } = await transcribeAudio(WEBM, testCtx(), {
      model: model({ durationInSeconds: config.limits.audio.maxSeconds + 30 }),
    });
    expect(result).toEqual({ status: "too_long" });
  });

  it("silence → empty", async () => {
    expect(
      (await transcribeAudio(WEBM, testCtx(), { model: model({ text: "  " }) })).result,
    ).toEqual({ status: "empty" });
  });

  it("provider error → failed(provider_error); timeout → failed(timeout)", async () => {
    const failing = new MockTranscriptionModelV4({
      doGenerate: async () => {
        throw new Error("down");
      },
    });
    expect((await transcribeAudio(WEBM, testCtx(), { model: failing })).result).toEqual({
      status: "failed",
      reason: "provider_error",
    });
    const hanging = new MockTranscriptionModelV4({
      doGenerate: ({ abortSignal }) =>
        new Promise((_, reject) =>
          abortSignal?.addEventListener("abort", () => reject(abortSignal.reason)),
        ),
    });
    expect(
      (await transcribeAudio(WEBM, testCtx(), { model: hanging, timeoutMs: 20 })).result,
    ).toEqual({ status: "failed", reason: "timeout" });
  });

  it("never puts the audio in the call metadata", async () => {
    const { call } = await transcribeAudio(WEBM, testCtx(), { model: model() });
    expect(Object.keys(call ?? {})).not.toContain("audio");
  });
});

describe("transcribe.handleTranscription", () => {
  const deps = (opts: { max?: number; rows?: UsageEntry[] } = {}) => ({
    model: model({ durationInSeconds: 3 }),
    limiters: {
      transcribe: createRateLimiter({ windowMs: 60_000, max: opts.max ?? 5, maxKeys: 10 }),
      modelCalls: createRateLimiter({ windowMs: 60_000, max: 5, maxKeys: 1 }),
    },
    ledger: { record: async (entry: UsageEntry) => void opts.rows?.push(entry) },
  });

  it("transcribes, then records audio seconds in the ledger", async () => {
    const rows: UsageEntry[] = [];
    const out = await handleTranscription(
      { audio: WEBM, contentType: "audio/webm", durationMs: 3_000 },
      testCtx(),
      deps({ rows }),
    );
    expect(out.httpStatus).toBe(200);
    expect(out.body).toMatchObject({ status: "ok" });
    await out.recorded;
    expect(rows).toEqual([
      expect.objectContaining({ step: "transcribe", audioSeconds: 3, outcome: "transcribed" }),
    ]);
  });

  it("is rate-limited separately, without a model call", async () => {
    const d = deps({ max: 0 });
    const out = await handleTranscription({ audio: WEBM, contentType: "audio/webm" }, testCtx(), d);
    expect(out.body).toEqual({ status: "rate_limited" });
  });

  it("maps bad input to 415 / 400 before the limiter and the model", async () => {
    expect(
      (await handleTranscription({ audio: WEBM, contentType: "audio/wav" }, testCtx(), deps()))
        .httpStatus,
    ).toBe(415);
    const tooLong = await handleTranscription(
      { audio: WEBM, contentType: "audio/webm", durationMs: 200_000 },
      testCtx(),
      deps(),
    );
    expect([tooLong.httpStatus, tooLong.body]).toEqual([400, { error: "too_long" }]);
  });
});
