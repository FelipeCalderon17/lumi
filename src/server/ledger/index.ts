import type { ModelId } from "../config";
import { NotImplementedError } from "../types";

/**
 * Usage ledger: one row per model call with token counts and an *estimated* cost.
 * It never stores message content — only numbers and enums.
 */

export type PipelineStage = "router" | "answer" | "judge";

export type LedgerOutcome = "ok" | "fallback" | "abstained" | "emergency" | "error";

export type UsageEntry = {
  requestId: string;
  stage: PipelineStage;
  model: ModelId;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  latencyMs: number;
  outcome: LedgerOutcome;
};

export interface UsageLedger {
  record(entry: UsageEntry): Promise<void>;
}

export function estimateCostUsd(
  _usage: Pick<UsageEntry, "model" | "inputTokens" | "cachedInputTokens" | "outputTokens">,
): number {
  // TODO(phase-3): (input - cached) * input + cached * cachedInput + output * output, per 1M.
  throw new NotImplementedError("ledger.estimateCostUsd");
}
