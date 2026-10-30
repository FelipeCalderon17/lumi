import { describe, expect, it } from "vitest";
import { estimateCostUsd, recordBestEffort, type UsageEntry, type UsageLedger } from "./index";

const usage = { inputTokens: 10_000, cachedInputTokens: 8_000, outputTokens: 200 };

describe("ledger.estimateCostUsd", () => {
  it("bills cached input tokens at the cached rate (gpt-6-luna placeholder prices)", () => {
    // 2_000 × 0.10 + 8_000 × 0.01 + 200 × 0.50 = 200 + 80 + 100 = 380 per 1M → $0.00038
    expect(estimateCostUsd({ model: "gpt-6-luna", ...usage })).toBeCloseTo(0.00038, 10);
  });

  it("returns null (not 0) when the price is unknown", () => {
    expect(estimateCostUsd({ model: "gpt-6.1-terra", ...usage })).toBeNull();
    expect(estimateCostUsd({ model: "gpt-6.1-sol", ...usage })).toBeNull();
  });

  it("returns null (not 0) when any token count is unknown", () => {
    expect(estimateCostUsd({ model: "gpt-6-luna", ...usage, cachedInputTokens: null })).toBeNull();
    expect(estimateCostUsd({ model: "gpt-6-sol", ...usage, outputTokens: null })).toBeNull();
  });
});

const entry: UsageEntry = {
  requestId: "00000000-0000-4000-8000-000000000000",
  stage: "answer",
  model: "gpt-6-luna",
  inputTokens: 1,
  cachedInputTokens: 0,
  outputTokens: 1,
  latencyMs: 10,
  estimatedCostUsd: null,
  finishReason: "stop",
  requestOutcome: "answer",
  failureReason: null,
};

describe("ledger.recordBestEffort", () => {
  it("resolves true when the write succeeds", async () => {
    const ledger: UsageLedger = { record: async () => {} };
    await expect(recordBestEffort(ledger, entry, 100)).resolves.toBe(true);
  });

  it("never throws when the database is down", async () => {
    const ledger: UsageLedger = {
      record: async () => {
        throw new Error("ECONNREFUSED");
      },
    };
    await expect(recordBestEffort(ledger, entry, 100)).resolves.toBe(false);
  });

  it("gives up after the timeout when the database hangs", async () => {
    const ledger: UsageLedger = { record: () => new Promise(() => {}) };
    const started = Date.now();
    await expect(recordBestEffort(ledger, entry, 20)).resolves.toBe(false);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
