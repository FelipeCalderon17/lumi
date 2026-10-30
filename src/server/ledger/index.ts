import { type ModelId, modelCatalog } from "../config";
import type { TerminalEvent } from "../pipeline";
import type { FailureReason, ModelCall } from "../types";

/**
 * Usage ledger: one row per model call (router AND answer), for successes and failures.
 * Cost per conversation = sum of rows with the same requestId, so router overhead is included.
 * It never stores message content, only numbers and enums.
 */

export type UsageEntry = ModelCall & {
  requestId: string;
  /** The request's terminal event type, or "cancelled" if the client went away first. */
  requestOutcome: TerminalEvent["type"] | "cancelled";
  /** Why this call's step failed, if it did. */
  failureReason: FailureReason | null;
};

export interface UsageLedger {
  record(entry: UsageEntry): Promise<void>;
}

const PER_MILLION = 1_000_000;

/**
 * Estimated USD for one call. `null` when any token count or any needed price is unknown:
 * an unknown cost is reported as unknown, never silently as 0.
 */
export function estimateCostUsd(
  usage: Pick<ModelCall, "inputTokens" | "cachedInputTokens" | "outputTokens"> & { model: ModelId },
): number | null {
  const price = modelCatalog[usage.model];
  const { inputTokens, cachedInputTokens, outputTokens } = usage;
  if (inputTokens === null || cachedInputTokens === null || outputTokens === null) return null;
  if (
    price.inputUsdPerMillion === null ||
    price.cachedInputUsdPerMillion === null ||
    price.outputUsdPerMillion === null
  ) {
    return null;
  }
  const uncached = Math.max(inputTokens - cachedInputTokens, 0);
  return (
    (uncached * price.inputUsdPerMillion +
      cachedInputTokens * price.cachedInputUsdPerMillion +
      outputTokens * price.outputUsdPerMillion) /
    PER_MILLION
  );
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
  const write = ledger.record(entry).then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([write, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
