import type { ModelId, PriceCatalog } from "../config";
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

/** Read side, for the staff summary. Bounded by a cutoff and a row limit. */
export interface UsageReader {
  since(cutoff: Date, limit: number): Promise<UsageRow[]>;
}

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
export function estimateCost(row: UsageFacts, catalog: PriceCatalog): CostEstimate {
  const price = catalog[row.model];
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

const sumKnown = (values: (number | null)[]) =>
  values.reduce<number>((total, value) => total + (value ?? 0), 0);

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
 * Aggregates ledger rows for the staff view, the evals and the README tables, deriving cost
 * from the catalog at read time. Pure: same rows + same catalog → same summary.
 */
export function summarizeUsage(rows: readonly UsageRow[], catalog: PriceCatalog): UsageSummary {
  const groups = new Map<string, UsageGroup>();
  let total: CostEstimate = 0;
  let cachedKnown = 0;
  let inputKnown = 0;

  for (const row of rows) {
    const key = `${row.step}|${row.model}`;
    const group = groups.get(key) ?? {
      step: row.step,
      model: row.model,
      calls: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      audioSeconds: 0,
      callsWithUnknownUsage: 0,
      estimatedUsd: 0,
    };
    groups.set(key, group);
    const cost = estimateCost(row, catalog);
    const tokenBilled = catalog[row.model]?.billing !== "audio_duration";
    const unknownUsage = tokenBilled
      ? row.inputTokens === null || row.cachedInputTokens === null || row.outputTokens === null
      : row.audioSeconds === null;

    group.calls += 1;
    group.inputTokens += sumKnown([row.inputTokens]);
    group.cachedInputTokens += sumKnown([row.cachedInputTokens]);
    group.outputTokens += sumKnown([row.outputTokens]);
    group.reasoningTokens += sumKnown([row.reasoningTokens]);
    group.audioSeconds += sumKnown([row.audioSeconds]);
    if (unknownUsage) group.callsWithUnknownUsage += 1;
    group.estimatedUsd = addCosts(group.estimatedUsd, cost);
    total = addCosts(total, cost);

    if (row.inputTokens !== null && row.cachedInputTokens !== null && row.inputTokens > 0) {
      inputKnown += row.inputTokens;
      cachedKnown += row.cachedInputTokens;
    }
  }

  const requests = new Set(rows.map((row) => row.requestId)).size;
  return {
    requests,
    groups: [...groups.values()].sort((a, b) =>
      `${a.step}|${a.model}`.localeCompare(`${b.step}|${b.model}`),
    ),
    cachedInputRatio: inputKnown > 0 ? cachedKnown / inputKnown : null,
    estimatedUsd: rows.length === 0 ? 0 : total,
    estimatedUsdPer1000Requests:
      total === "unknown" ? "unknown" : requests === 0 ? 0 : (total / requests) * 1_000,
  };
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
