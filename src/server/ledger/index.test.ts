import { describe, expect, it } from "vitest";
import { modelCatalog, type PriceCatalog } from "../config";
import type { ModelCall } from "../types";
import {
  addCosts,
  createNoopLedger,
  estimateCost,
  estimateGroupCost,
  recordBestEffort,
  recordCallsBestEffort,
  summarizeTotals,
  summarizeUsage,
  totalsFromRows,
  type UsageEntry,
  type UsageLedger,
  type UsageRow,
} from "./index";

const facts = {
  inputTokens: 10_000,
  cachedInputTokens: 8_000,
  outputTokens: 200,
  audioSeconds: null,
};

describe("ledger.estimateCost", () => {
  it("bills cached input tokens at the cached rate (gpt-6-luna placeholder prices)", () => {
    // 2_000 × 0.10 + 8_000 × 0.01 + 200 × 0.50 = 200 + 80 + 100 = 380 per 1M → $0.00038
    expect(estimateCost({ model: "gpt-6-luna", ...facts }, modelCatalog)).toBeCloseTo(0.00038, 10);
  });

  it("returns 'unknown' (not 0) when the price is unknown", () => {
    expect(estimateCost({ model: "gpt-6.1-terra", ...facts }, modelCatalog)).toBe("unknown");
    expect(estimateCost({ model: "gpt-6.1-sol", ...facts }, modelCatalog)).toBe("unknown");
    expect(
      estimateCost({ model: "gpt-transcribe", ...facts, audioSeconds: 30 }, modelCatalog),
    ).toBe("unknown");
  });

  it("returns 'unknown' (not 0) when any token count is unknown", () => {
    expect(
      estimateCost({ model: "gpt-6-luna", ...facts, cachedInputTokens: null }, modelCatalog),
    ).toBe("unknown");
    expect(estimateCost({ model: "gpt-6-sol", ...facts, outputTokens: null }, modelCatalog)).toBe(
      "unknown",
    );
  });

  it("derives the cost from whatever catalog it's given, so a price fix corrects old rows", () => {
    const halved: PriceCatalog = {
      ...modelCatalog,
      "gpt-6-luna": { ...modelCatalog["gpt-6-luna"], inputUsdPerMillion: 0.05 },
    };
    // 2_000 × 0.05 + 80 + 100 = 280 per 1M
    expect(estimateCost({ model: "gpt-6-luna", ...facts }, halved)).toBeCloseTo(0.00028, 10);
  });

  it("prices duration-billed transcription per minute, and needs the duration", () => {
    const priced: PriceCatalog = {
      ...modelCatalog,
      "gpt-transcribe": { ...modelCatalog["gpt-transcribe"], usdPerMinute: 0.006 },
    };
    const row = { model: "gpt-transcribe" as const, ...facts, audioSeconds: 90 };
    expect(estimateCost(row, priced)).toBeCloseTo(0.009, 10);
    expect(estimateCost({ ...row, audioSeconds: null }, priced)).toBe("unknown");
  });
});

describe("ledger price lookup (Codex review 3 can-wait)", () => {
  it("a model id that is an Object.prototype key is unknown, not NaN", () => {
    for (const model of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(estimateCost({ model: model as "gpt-6-luna", ...facts }, modelCatalog)).toBe(
        "unknown",
      );
    }
  });
});

describe("ledger.addCosts", () => {
  it("anything unknown makes the sum unknown", () => {
    expect(addCosts(1, 2)).toBe(3);
    expect(addCosts(1, "unknown")).toBe("unknown");
  });
});

const row = (overrides: Partial<UsageRow>): UsageRow => ({
  requestId: "r1",
  step: "answer",
  model: "gpt-6-luna",
  outcome: "answer",
  inputTokens: 10_000,
  cachedInputTokens: 8_000,
  outputTokens: 200,
  reasoningTokens: 50,
  audioSeconds: null,
  latencyMs: 1_000,
  ...overrides,
});

describe("ledger.summarizeUsage", () => {
  it("groups by step and model, counts requests and derives cost per 1,000 requests", () => {
    const summary = summarizeUsage(
      [
        row({ step: "router", inputTokens: 500, cachedInputTokens: 0, outputTokens: 40 }),
        row({}),
        row({ requestId: "r2" }),
      ],
      modelCatalog,
    );
    expect(summary.requests).toBe(2);
    expect(summary.groups.map((g) => [g.step, g.calls])).toEqual([
      ["answer", 2],
      ["router", 1],
    ]);
    // router: 500 × 0.10 + 40 × 0.50 = 70 per 1M; answers: 2 × 380 per 1M → 830 per 1M total.
    expect(summary.estimatedUsd).toBeCloseTo(0.00083, 10);
    expect(summary.estimatedUsdPer1000Requests).toBeCloseTo(0.415, 10);
    expect(summary.cachedInputRatio).toBeCloseTo(16_000 / 20_500, 10);
  });

  it("reports an unknown price or unknown usage as unknown, never as $0", () => {
    const summary = summarizeUsage(
      [row({}), row({ requestId: "r2", outputTokens: null }), row({ model: "gpt-6.1-terra" })],
      modelCatalog,
    );
    const luna = summary.groups.find((g) => g.model === "gpt-6-luna");
    expect(luna?.callsWithUnknownUsage).toBe(1);
    expect(luna?.estimatedUsd).toBe("unknown");
    expect(summary.groups.find((g) => g.model === "gpt-6.1-terra")?.estimatedUsd).toBe("unknown");
    expect(summary.estimatedUsd).toBe("unknown");
    expect(summary.estimatedUsdPer1000Requests).toBe("unknown");
  });

  it("aggregated totals cost exactly the sum of per-call estimates (SQL path = row path)", () => {
    const rows = [
      row({ step: "router", inputTokens: 500, cachedInputTokens: 0, outputTokens: 40 }),
      row({}),
      row({ requestId: "r2", inputTokens: 3_000, cachedInputTokens: 2_500, outputTokens: 90 }),
      row({ requestId: "r3", inputTokens: 100, cachedInputTokens: 300, outputTokens: 5 }),
    ];
    const perCall = rows.reduce((sum, r) => sum + (estimateCost(r, modelCatalog) as number), 0);
    const summary = summarizeTotals(totalsFromRows(rows), modelCatalog);
    expect(summary.estimatedUsd).toBeCloseTo(perCall, 12);
    expect(summary).toEqual(summarizeUsage(rows, modelCatalog));
  });

  it("estimateGroupCost: unknown usage in any call, or an unknown model, is unknown", () => {
    const [group] = totalsFromRows([row({}), row({ outputTokens: null })]).groups;
    if (!group) throw new Error("no group");
    expect(estimateGroupCost(group, modelCatalog)).toBe("unknown");
    expect(estimateGroupCost({ ...group, callsWithUnknownTokens: 0 }, modelCatalog)).toEqual(
      expect.any(Number),
    );
    expect(
      estimateGroupCost(
        { ...group, callsWithUnknownTokens: 0, model: "retired-model" as "gpt-6-luna" },
        modelCatalog,
      ),
    ).toBe("unknown");
  });

  it("an empty ledger costs nothing and has no cache ratio", () => {
    expect(summarizeUsage([], modelCatalog)).toEqual({
      requests: 0,
      groups: [],
      cachedInputRatio: null,
      estimatedUsd: 0,
      estimatedUsdPer1000Requests: 0,
    });
  });
});

const call: ModelCall = {
  step: "answer",
  model: "gpt-6-luna",
  inputTokens: 1,
  cachedInputTokens: 0,
  outputTokens: 1,
  reasoningTokens: null,
  audioSeconds: null,
  latencyMs: 10,
  finishReason: "stop",
};
const entry: UsageEntry = {
  ...call,
  requestId: "00000000-0000-4000-8000-000000000000",
  outcome: "answer",
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

  it("never throws when the ledger throws synchronously", async () => {
    const ledger: UsageLedger = {
      record: () => {
        throw new Error("boom");
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

describe("ledger.recordCallsBestEffort", () => {
  it("writes every call with the request's id and final outcome", async () => {
    const written: UsageEntry[] = [];
    const ledger: UsageLedger = { record: async (e) => void written.push(e) };
    await recordCallsBestEffort(
      ledger,
      [
        { call: { ...call, step: "router" }, failureReason: null },
        { call, failureReason: "truncated" },
      ],
      { requestId: "r", outcome: "fallback" },
      100,
    );
    expect(written.map((e) => [e.step, e.outcome, e.failureReason])).toEqual([
      ["router", "fallback", null],
      ["answer", "fallback", "truncated"],
    ]);
    expect(Object.keys(written[0] ?? {})).not.toContain("estimatedCostUsd");
  });
});

describe("ledger.createNoopLedger", () => {
  it("records nothing and warns once", async () => {
    const warnings: string[] = [];
    const ledger = createNoopLedger((m) => warnings.push(m));
    await ledger.record(entry);
    await ledger.record(entry);
    expect(warnings).toHaveLength(1);
  });
});
