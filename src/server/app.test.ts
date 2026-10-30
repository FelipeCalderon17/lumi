import { describe, expect, it, vi } from "vitest";
import { createServerDeps } from "./app";

describe("app.createServerDeps (composition root)", () => {
  it("without DATABASE_URL: no-op ledger, gaps unavailable, usage unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deps = createServerDeps({});
    expect(deps.gapStore).toBeNull();
    expect(deps.usageReader).toBeNull();
    await expect(
      deps.ledger.record({
        requestId: "r",
        step: "router",
        model: "gpt-6-luna",
        inputTokens: 1,
        cachedInputTokens: 0,
        outputTokens: 1,
        reasoningTokens: null,
        audioSeconds: null,
        latencyMs: 1,
        finishReason: "stop",
        outcome: "crisis",
        failureReason: null,
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("without staff env vars: staff area disabled (fail closed)", () => {
    expect(createServerDeps({}).staffAuth.enabled).toBe(false);
  });

  it("with DATABASE_URL: DB-backed stores, created without connecting", () => {
    const deps = createServerDeps({ DATABASE_URL: "postgres://user:pw@127.0.0.1:1/lumi" });
    expect(deps.gapStore).not.toBeNull();
    expect(deps.usageReader).not.toBeNull();
  });

  it("every limiter is separate", () => {
    const { limiters } = createServerDeps({});
    expect(new Set(Object.values(limiters)).size).toBe(Object.keys(limiters).length);
  });
});
