import { describe, expect, it } from "vitest";
import type { UsageReader, UsageRow } from "./ledger";
import { staffOverview } from "./staff";
import { memoryGapStore } from "./test-helpers";

const row: UsageRow = {
  requestId: "r1",
  step: "answer",
  model: "gpt-6-luna",
  outcome: "answer",
  inputTokens: 10_000,
  cachedInputTokens: 8_000,
  outputTokens: 200,
  reasoningTokens: 50,
  audioSeconds: null,
  latencyMs: 900,
};

describe("staff.staffOverview", () => {
  it("lists gaps and summarises usage with cost derived from the catalog", async () => {
    const { store } = memoryGapStore();
    await store.insert({
      id: "00000000-0000-4000-8000-000000000001",
      question: "Q",
      language: "en",
      topic: "other",
      deleteTokenHash: "h",
    });
    const usage: UsageReader = { since: async () => [row, { ...row, model: "gpt-6.1-terra" }] };
    const overview = await staffOverview({ gaps: store, usage });
    expect(overview.gaps).toMatchObject({ status: "ok", items: [{ question: "Q" }] });
    if (overview.usage.status !== "ok") throw new Error(overview.usage.status);
    expect(overview.usage.summary.groups.map((g) => [g.model, g.estimatedUsd])).toEqual([
      ["gpt-6-luna", expect.closeTo(0.00038, 10)],
      ["gpt-6.1-terra", "unknown"],
    ]);
    expect(overview.usage.summary.estimatedUsd).toBe("unknown");
  });

  it("degrades each half on its own: no database, or the database failing", async () => {
    expect(await staffOverview({ gaps: null, usage: null })).toEqual({
      gaps: { status: "unavailable" },
      usage: { status: "unavailable" },
    });
    const failing: UsageReader = { since: async () => Promise.reject(new Error("down")) };
    const overview = await staffOverview({ gaps: memoryGapStore().store, usage: failing });
    expect(overview).toEqual({ gaps: { status: "ok", items: [] }, usage: { status: "failed" } });
  });
});
