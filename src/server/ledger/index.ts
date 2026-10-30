import type { ModelId, ModelPrice, PriceCatalog } from "../config";
import { TERMINAL_EVENT_TYPES } from "../events";
import type { FailureReason, ModelCall, ModelStepName } from "../types";

/**
 * Usage ledger: one row per model call (router, answer, transcribe, notebook), for successes
 * and failures. It stores token FACTS, never cost (ADR 0013): prices change, and a stored cost
 * goes stale with no way to correct it. Cost is derived on read with `estimateCost`.
 * Cost per conversation = sum of rows with the same requestId, so router overhead is included.
 * It never stores message content, only numbers and enums.
 */

/** How the request that made this call ended. Chat terminal events, plus the other endpoints'. */
export const LEDGER_OUTCOMES = [
  ...TERMINAL_EVENT_TYPES,
  /** The client went away before the end. */
  "cancelled",
  /** POST /api/transcribe returned text. */
  "transcribed",
  /** POST /api/notebook/prepare returned a structured page. */
  "notebook",
] as const;
export type LedgerOutcome = (typeof LEDGER_OUTCOMES)[number];

export type UsageEntry = ModelCall & {
  requestId: string;
  outcome: LedgerOutcome;
  /** Why this call's step failed, if it did. */
  failureReason: FailureReason | null;
};

export interface UsageLedger {
  record(entry: UsageEntry): Promise<void>;
}

/**
 * Read side, for the staff summary. Aggregates EVERY row since `cutoff` in the database (one
 * row per step × model), so the totals cover the whole window however many calls it holds.
 * Returns at most `maxGroups + 1` groups, so the caller can tell when it hit that bound.
 */
export interface UsageReader {
  totalsSince(cutoff: Date, maxGroups: number): Promise<UsageTotals>;
}

/** Summed token facts for one step × model. Sums skip unknown (NULL) values. */
export type UsageGroupTotals = {
  step: ModelStepName;
  model: ModelId;
  calls: number;
  inputTokens: number;
  /** Σ max(input − cached, 0) over calls where both are known. */
  uncachedInputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  audioSeconds: number;
  /** Calls missing input, cached input or output tokens. */
  callsWithUnknownTokens: number;
  /** Calls missing the audio duration. */
  callsWithUnknownAudio: number;
  /** Input and cached tokens over calls where both are known and input > 0 (cache ratio). */
  ratioInputTokens: number;
  ratioCachedTokens: number;
};

export type UsageTotals = { requests: number; groups: UsageGroupTotals[] };

/** The numeric facts cost is derived from (a ledger row, or an eval run's call). */
export type UsageFacts = Pick<
  ModelCall,
  "inputTokens" | "cachedInputTokens" | "outputTokens" | "audioSeconds"
> & { model: ModelId };

/** A cost we can state, or "unknown". Never 0 for something we don't know. */
export type CostEstimate = number | "unknown";

const PER_MILLION = 1_000_000;

/**
 * Estimated USD for one call, from the price catalog in config. "unknown" when the model has
 * no price, or when a token count / duration the price needs is unknown.
 */
/** Own-property lookup: a ledger model id like "constructor" is unknown, not a prototype key. */
function priceOf(model: string, catalog: PriceCatalog): ModelPrice | undefined {
  return Object.hasOwn(catalog, model) ? catalog[model as ModelId] : undefined;
}

export function estimateCost(row: UsageFacts, catalog: PriceCatalog): CostEstimate {
  const price = priceOf(row.model, catalog);
  if (!price) return "unknown";
  if (price.billing === "audio_duration") {
    if (price.usdPerMinute === null || row.audioSeconds === null) return "unknown";
    return (row.audioSeconds / 60) * price.usdPerMinute;
  }
  const { inputTokens, cachedInputTokens, outputTokens } = row;
  if (inputTokens === null || cachedInputTokens === null || outputTokens === null) {
    return "unknown";
  }
  if (
    price.inputUsdPerMillion === null ||
    price.cachedInputUsdPerMillion === null ||
    price.outputUsdPerMillion === null
  ) {
    return "unknown";
  }
  const uncached = Math.max(inputTokens - cachedInputTokens, 0);
  return (
    (uncached * price.inputUsdPerMillion +
      cachedInputTokens * price.cachedInputUsdPerMillion +
      outputTokens * price.outputUsdPerMillion) /
    PER_MILLION
  );
}

/** Adds costs; anything unknown makes the total unknown. */
export function addCosts(a: CostEstimate, b: CostEstimate): CostEstimate {
  return a === "unknown" || b === "unknown" ? "unknown" : a + b;
}

export type UsageRow = UsageFacts &
  Pick<ModelCall, "step" | "reasoningTokens" | "latencyMs"> & {
    requestId: string;
    outcome: LedgerOutcome;
  };

export type UsageGroup = {
  step: ModelStepName;
  model: ModelId;
  calls: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  audioSeconds: number;
  /** Calls with at least one unknown count (their tokens are left out of the sums above). */
  callsWithUnknownUsage: number;
  /** "unknown" if the price is unknown or any call's usage is unknown. */
  estimatedUsd: CostEstimate;
};

export type UsageSummary = {
  requests: number;
  groups: UsageGroup[];
  /** Cached share of input tokens, over calls where both are known. `null` if no data. */
  cachedInputRatio: number | null;
  estimatedUsd: CostEstimate;
  /** Total cost ÷ requests × 1,000. "unknown" whenever the total is. */
  estimatedUsdPer1000Requests: CostEstimate;
};

/**
 * Cost of a whole group, from its summed facts. Cost is linear in tokens, so this equals the
 * sum of per-call estimateCost; any call with unknown usage makes it "unknown".
 */
export function estimateGroupCost(group: UsageGroupTotals, catalog: PriceCatalog): CostEstimate {
  const price = priceOf(group.model, catalog);
  if (!price) return "unknown";
  if (price.billing === "audio_duration") {
    if (price.usdPerMinute === null || group.callsWithUnknownAudio > 0) return "unknown";
    return (group.audioSeconds / 60) * price.usdPerMinute;
  }
  if (
    group.callsWithUnknownTokens > 0 ||
    price.inputUsdPerMillion === null ||
    price.cachedInputUsdPerMillion === null ||
    price.outputUsdPerMillion === null
  ) {
    return "unknown";
  }
  return (
    (group.uncachedInputTokens * price.inputUsdPerMillion +
      group.cachedInputTokens * price.cachedInputUsdPerMillion +
      group.outputTokens * price.outputUsdPerMillion) /
    PER_MILLION
  );
}

/**
 * Summary from aggregated totals (the staff view: SQL does the sums), deriving cost from the
 * catalog at read time. Pure: same totals + same catalog → same summary.
 */
export function summarizeTotals(totals: UsageTotals, catalog: PriceCatalog): UsageSummary {
  const groups = totals.groups.map((g): UsageGroup => {
    const cost = estimateGroupCost(g, catalog);
    const audioBilled = priceOf(g.model, catalog)?.billing === "audio_duration";
    return {
      step: g.step,
      model: g.model,
      calls: g.calls,
      inputTokens: g.inputTokens,
      cachedInputTokens: g.cachedInputTokens,
      outputTokens: g.outputTokens,
      reasoningTokens: g.reasoningTokens,
      audioSeconds: g.audioSeconds,
      callsWithUnknownUsage: audioBilled ? g.callsWithUnknownAudio : g.callsWithUnknownTokens,
      estimatedUsd: cost,
    };
  });
  const total = groups.reduce<CostEstimate>((sum, g) => addCosts(sum, g.estimatedUsd), 0);
  const ratioInput = totals.groups.reduce((sum, g) => sum + g.ratioInputTokens, 0);
  const ratioCached = totals.groups.reduce((sum, g) => sum + g.ratioCachedTokens, 0);
  const { requests } = totals;
  return {
    requests,
    groups: groups.sort((a, b) => `${a.step}|${a.model}`.localeCompare(`${b.step}|${b.model}`)),
    cachedInputRatio: ratioInput > 0 ? ratioCached / ratioInput : null,
    estimatedUsd: groups.length === 0 ? 0 : total,
    estimatedUsdPer1000Requests:
      total === "unknown" ? "unknown" : requests === 0 ? 0 : (total / requests) * 1_000,
  };
}

/** The same sums the SQL reader computes, done in memory (evals, smoke runs, tests). */
export function totalsFromRows(rows: readonly UsageRow[]): UsageTotals {
  const groups = new Map<string, UsageGroupTotals>();
  for (const row of rows) {
    const key = `${row.step}|${row.model}`;
    const g = groups.get(key) ?? {
      step: row.step,
      model: row.model,
      calls: 0,
      inputTokens: 0,
      uncachedInputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      audioSeconds: 0,
      callsWithUnknownTokens: 0,
      callsWithUnknownAudio: 0,
      ratioInputTokens: 0,
      ratioCachedTokens: 0,
    };
    groups.set(key, g);
    const { inputTokens, cachedInputTokens, outputTokens } = row;
    g.calls += 1;
    g.inputTokens += inputTokens ?? 0;
    g.cachedInputTokens += cachedInputTokens ?? 0;
    g.outputTokens += outputTokens ?? 0;
    g.reasoningTokens += row.reasoningTokens ?? 0;
    g.audioSeconds += row.audioSeconds ?? 0;
    if (inputTokens !== null && cachedInputTokens !== null) {
      g.uncachedInputTokens += Math.max(inputTokens - cachedInputTokens, 0);
      if (inputTokens > 0) {
        g.ratioInputTokens += inputTokens;
        g.ratioCachedTokens += cachedInputTokens;
      }
    }
    if (inputTokens === null || cachedInputTokens === null || outputTokens === null) {
      g.callsWithUnknownTokens += 1;
    }
    if (row.audioSeconds === null) g.callsWithUnknownAudio += 1;
  }
  return { requests: new Set(rows.map((r) => r.requestId)).size, groups: [...groups.values()] };
}

/** Aggregates in-memory ledger rows (evals, smoke runs). Same maths as the staff view. */
export function summarizeUsage(rows: readonly UsageRow[], catalog: PriceCatalog): UsageSummary {
  return summarizeTotals(totalsFromRows(rows), catalog);
}

/**
 * Best-effort, time-bounded write. Never throws and never takes longer than `timeoutMs`,
 * so a slow or down database can't delay or break a response. Call it AFTER the terminal
 * event has been sent. Returns whether the write completed in time.
 */
export async function recordBestEffort(
  ledger: UsageLedger,
  entry: UsageEntry,
  timeoutMs: number,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  let write: Promise<boolean>;
  try {
    write = ledger.record(entry).then(
      () => true,
      () => false,
    );
  } catch {
    // A ledger that throws synchronously is as "down" as one that rejects.
    write = Promise.resolve(false);
  }
  try {
    return await Promise.race([write, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Records every call of one request with its final outcome, in parallel, within `timeoutMs`. */
export async function recordCallsBestEffort(
  ledger: UsageLedger,
  calls: readonly { call: ModelCall; failureReason: FailureReason | null }[],
  request: { requestId: string; outcome: LedgerOutcome },
  timeoutMs: number,
): Promise<boolean[]> {
  return Promise.all(
    calls.map(({ call, failureReason }) =>
      recordBestEffort(ledger, { ...call, ...request, failureReason }, timeoutMs),
    ),
  );
}

/**
 * Used when DATABASE_URL is absent: the app still works, the ledger just records nothing.
 * Warns once so it's visible in the logs, without logging any entry.
 */
export function createNoopLedger(warn: (message: string) => void = console.warn): UsageLedger {
  let warned = false;
  return {
    async record() {
      if (!warned) {
        warned = true;
        warn("usage ledger disabled: DATABASE_URL is not set (no usage is recorded)");
      }
    },
  };
}
