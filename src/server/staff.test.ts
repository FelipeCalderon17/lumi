import { describe, expect, it } from "vitest";
import { totalsFromRows, type UsageReader, type UsageRow } from "./ledger";
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
    const usage: UsageReader = {
      totalsSince: async () => totalsFromRows([row, { ...row, model: "gpt-6.1-terra" }]),
    };
    const overview = await staffOverview({ gaps: store, usage });
    expect(overview.gaps).toMatchObject({ status: "ok", items: [{ question: "Q" }] });
    expect(overview.usage).toMatchObject({ status: "ok", windowDays: 30, complete: true });
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
    const failing: UsageReader = { totalsSince: async () => Promise.reject(new Error("down")) };
    const overview = await staffOverview({ gaps: memoryGapStore().store, usage: failing });
    expect(overview).toEqual({ gaps: { status: "ok", items: [] }, usage: { status: "failed" } });
  });

  it("regression (Codex review 3): asks the store for the whole window, with no row limit", async () => {
    const asked: { cutoff: Date; maxGroups: number }[] = [];
    const usage: UsageReader = {
      totalsSince: async (cutoff, maxGroups) => {
        asked.push({ cutoff, maxGroups });
        // 50,000 calls aggregated by the store: far more than the old 20,000-row cap.
        return {
          requests: 25_000,
          groups: [
            { ...totalsFromRows([row]).groups[0], calls: 50_000 } as ReturnType<
              typeof totalsFromRows
            >["groups"][number],
          ],
        };
      },
    };
    const now = new Date("2026-10-30T00:00:00Z");
    const overview = await staffOverview({ gaps: null, usage }, now);
    expect(asked).toEqual([{ cutoff: new Date("2026-09-30T00:00:00Z"), maxGroups: 100 }]);
    expect(overview.usage).toMatchObject({
      status: "ok",
      complete: true,
      summary: { requests: 25_000, groups: [{ calls: 50_000 }] },
    });
  });

  it("more groups than the bound → complete: false with a reason, never presented as complete", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({ ...row, model: `old-model-${i}` }));
    const usage: UsageReader = {
      totalsSince: async () => totalsFromRows(rows as unknown as UsageRow[]),
    };
    const overview = await staffOverview({ gaps: null, usage });
    expect(overview.usage).toMatchObject({
      status: "ok",
      complete: false,
      incompleteReason: "too_many_groups",
    });
    if (overview.usage.status !== "ok") throw new Error("not ok");
    expect(overview.usage.summary.groups).toHaveLength(100);
  });
});
