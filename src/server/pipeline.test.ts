import { describe, expect, it } from "vitest";
import { config } from "./config";
import { ChatRequestSchema } from "./pipeline";

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
});
