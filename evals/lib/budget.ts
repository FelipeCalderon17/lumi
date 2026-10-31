import type { ModelId, PriceCatalog } from "../../src/server/config";
import { type CostEstimate, estimateCost } from "../../src/server/ledger";

/**
 * Budget guard (docs/EVALS.md § Budget guard). Two parts, both pure:
 *
 * 1. `estimateCalls`: the pre-run estimate. Cold (no prompt caching), warm (a repeated prefix
 *    is mostly cached after its first call) and worst case (cold input + every output cap).
 * 2. `createBudgetGuard`: the runtime guard. Before each call the runner RESERVES that call's
 *    worst case; if spent + reserved + the new reservation would pass the cap, it refuses and
 *    the run stops cleanly. After the call, the reservation is replaced by the actual cost from
 *    the provider's usage (or kept whole if the usage is unknown). So the actual spend can't pass
 *    the cap unless a call's input is larger than its estimate (charsPerToken is conservative).
 */

export type Step = "router" | "answer" | "judge" | "notebook";

/** One planned model call, in estimated tokens. */
export type CallEstimate = {
  step: Step;
  model: ModelId;
  inputTokens: number;
  /** Leading tokens identical across calls with the same `prefixKey` (cacheable). */
  prefixTokens: number;
  prefixKey: string | null;
  expectedOutputTokens: number;
  maxOutputTokens: number;
};

export type Estimate = {
  cold: number;
  warm: number;
  worst: number;
  calls: number;
  /** Models with no price in the catalog: their calls can't be estimated. */
  unknownPrice: ModelId[];
};

export function tokensFromChars(chars: number, charsPerToken: number): number {
  return Math.ceil(chars / charsPerToken);
}

function price(
  model: ModelId,
  input: number,
  cached: number,
  output: number,
  catalog: PriceCatalog,
): CostEstimate {
  return estimateCost(
    {
      model,
      inputTokens: input,
      cachedInputTokens: cached,
      outputTokens: output,
      audioSeconds: null,
    },
    catalog,
  );
}

/** Worst case for one call: nothing cached, the output cap used in full. */
export function worstCaseUsd(call: CallEstimate, catalog: PriceCatalog): CostEstimate {
  return price(call.model, call.inputTokens, 0, call.maxOutputTokens, catalog);
}

export function estimateCalls(
  calls: readonly CallEstimate[],
  catalog: PriceCatalog,
  opts: { warmCachedShare: number; minCacheablePrefixTokens: number },
): Estimate {
  const seen = new Set<string>();
  const unknown = new Set<ModelId>();
  let cold = 0;
  let warm = 0;
  let worst = 0;
  for (const call of calls) {
    const coldUsd = price(call.model, call.inputTokens, 0, call.expectedOutputTokens, catalog);
    const worstUsd = worstCaseUsd(call, catalog);
    const key = call.prefixKey ? `${call.model}|${call.prefixKey}` : null;
    const cacheable =
      key !== null && seen.has(key) && call.prefixTokens >= opts.minCacheablePrefixTokens;
    if (key) seen.add(key);
    const cached = cacheable ? Math.floor(call.prefixTokens * opts.warmCachedShare) : 0;
    const warmUsd = price(call.model, call.inputTokens, cached, call.expectedOutputTokens, catalog);
    if (coldUsd === "unknown" || worstUsd === "unknown" || warmUsd === "unknown") {
      unknown.add(call.model);
      continue;
    }
    cold += coldUsd;
    warm += warmUsd;
    worst += worstUsd;
  }
  return { cold, warm, worst, calls: calls.length, unknownPrice: [...unknown] };
}

export type Reservation = { id: number; usd: number };

export type BudgetGuard = {
  /** Reserves `usd` if it fits under the cap; otherwise stops the guard and returns null. */
  tryReserve(usd: number, label: string): Reservation | null;
  /** Replaces a reservation with the actual cost. Unknown actual cost → the reservation stays spent. */
  settle(reservation: Reservation, actual: CostEstimate): void;
  readonly capUsd: number;
  readonly spentUsd: number;
  readonly reservedUsd: number;
  /** Why the guard stopped (the label of the call that didn't fit), or null. */
  readonly stoppedAt: string | null;
  /** Calls whose actual cost was above their reservation (the estimate was too low). */
  readonly overruns: number;
  /** Calls whose actual cost was unknown and was charged at the reservation. */
  readonly unknownCostCalls: number;
};

export function createBudgetGuard(capUsd: number): BudgetGuard {
  let spent = 0;
  let reserved = 0;
  let nextId = 1;
  let stoppedAt: string | null = null;
  let overruns = 0;
  let unknownCostCalls = 0;
  const open = new Map<number, number>();
  return {
    tryReserve(usd, label) {
      if (stoppedAt !== null) return null;
      if (!Number.isFinite(usd) || usd < 0 || spent + reserved + usd > capUsd) {
        stoppedAt = label;
        return null;
      }
      const reservation = { id: nextId++, usd };
      open.set(reservation.id, usd);
      reserved += usd;
      return reservation;
    },
    settle(reservation, actual) {
      const usd = open.get(reservation.id);
      if (usd === undefined) return;
      open.delete(reservation.id);
      reserved -= usd;
      if (actual === "unknown") {
        unknownCostCalls += 1;
        spent += usd;
        return;
      }
      if (actual > usd) overruns += 1;
      spent += actual;
    },
    capUsd,
    get spentUsd() {
      return spent;
    },
    get reservedUsd() {
      return reserved;
    },
    get stoppedAt() {
      return stoppedAt;
    },
    get overruns() {
      return overruns;
    },
    get unknownCostCalls() {
      return unknownCostCalls;
    },
  };
}
