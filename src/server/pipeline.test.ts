import { describe, expect, it } from "vitest";
import { config } from "./config";
import {
  type ChatEvent,
  ChatRequestSchema,
  ChatRequestShapeSchema,
  encodeEvent,
  isTerminal,
} from "./pipeline";

describe("pipeline.ChatRequestSchema (contract)", () => {
  it("accepts a normal question", () => {
    expect(
      ChatRequestSchema.safeParse({ message: "Where can I park?", locale: "en" }).success,
    ).toBe(true);
  });

  it("rejects messages above the configured limit before any model call", () => {
    const tooLong = "a".repeat(config.limits.maxInputChars + 1);
    expect(ChatRequestSchema.safeParse({ message: tooLong, locale: "es" }).success).toBe(false);
  });

  it("the shape check alone accepts a long message, so safety can still run on it", () => {
    const tooLong = "he is not breathing ".repeat(100);
    expect(ChatRequestShapeSchema.safeParse({ message: tooLong, locale: "en" }).success).toBe(true);
  });
});

describe("pipeline transport (contract)", () => {
  it("frames each event as one JSON line", () => {
    const line = encodeEvent({ type: "progress", stage: "reading_guides" });
    expect(line.endsWith("\n")).toBe(true);
    expect(line.slice(0, -1)).not.toContain("\n");
    expect(JSON.parse(line)).toEqual({ type: "progress", stage: "reading_guides" });
  });

  it("escapes newlines inside answer text so framing survives", () => {
    const event: ChatEvent = { type: "answer", language: "en", text: "a\nb [1]", citations: [] };
    expect(encodeEvent(event).split("\n")).toHaveLength(2);
  });

  it("progress is the only non-terminal event", () => {
    expect(isTerminal({ type: "progress", stage: "reading_guides" })).toBe(false);
    expect(isTerminal({ type: "fallback", reason: "timeout", language: "es" })).toBe(true);
    expect(isTerminal({ type: "crisis", language: "en" })).toBe(true);
  });
});

describe("pipeline.runPipeline (planned, Phase 2)", () => {
  it.todo("safety runs before the rate limiter: an emergency is answered even when rate-limited");
  it.todo("safety runs on an over-length message before the length check");
  it.todo("yields exactly one terminal event for every path, optionally after progress events");
  it.todo("never yields model text before citation integrity passes (buffer → validate → reveal)");
  it.todo("router 'urgent' → emergency(detectedBy: router) with no answer call");
  it.todo(
    "router 'medical' → fixed medical template linking the care-team article, no answer call",
  );
  it.todo("provider error (mocked) → fallback(provider_error), ledger row with finishReason none");
  it.todo("router timeout (mocked) → fallback(timeout)");
  it.todo("answer finishReason 'length' → fallback(truncated), text withheld");
  it.todo("database down (mocked ledger throws/hangs) → response unaffected and not delayed");
  it.todo(
    "client disconnect (request signal aborted) → model call aborted, ledger outcome cancelled",
  );
  it.todo("instance model-call ceiling reached → fallback(capacity) without a model call");
});
