import { openai } from "@ai-sdk/openai";
import type { LanguageModel, LanguageModelUsage, TranscriptionModel } from "ai";
import { config, type ModelId } from "./config";
import { isDeadline } from "./context";
import type { FailureReason, ModelCall } from "./types";

/**
 * Model access, injected into every model-backed step so tests can pass AI SDK mocks
 * (`MockLanguageModelV4`, `MockTranscriptionModelV4`) and never touch the network.
 */
export interface ModelProvider {
  language(id: ModelId): LanguageModel;
  transcription(id: ModelId): TranscriptionModelV4;
}

/** A concrete (spec v4) transcription model, so we can wrap it to read the provider's usage. */
export type TranscriptionModelV4 = Extract<TranscriptionModel, { specificationVersion: "v4" }>;

/**
 * The real provider. `@ai-sdk/openai` reads OPENAI_API_KEY when a call is made, not at import,
 * so the app builds and starts without a key; a call without one fails like any provider
 * error and ends in the calm fallback.
 */
export function createOpenAIProvider(): ModelProvider {
  return {
    language: (id) => openai(id),
    transcription: (id) => openai.transcription(id),
  };
}

type TokenFacts = Pick<
  ModelCall,
  "inputTokens" | "cachedInputTokens" | "outputTokens" | "reasoningTokens"
>;

/** AI SDK usage → ledger facts. Missing numbers stay `null` (unknown), never 0. */
export function tokenFacts(usage: LanguageModelUsage | undefined): TokenFacts {
  return {
    inputTokens: usage?.inputTokens ?? null,
    cachedInputTokens: usage?.inputTokenDetails?.cacheReadTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    reasoningTokens: usage?.outputTokenDetails?.reasoningTokens ?? null,
  };
}

export const UNKNOWN_TOKENS: TokenFacts = {
  inputTokens: null,
  cachedInputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
};

/**
 * Why a model call failed: our own stage signal tells a deadline (timeout) from the client
 * going away (cancelled). Anything else is the provider's problem.
 */
export function failureFromError(signal: AbortSignal): FailureReason {
  if (signal.aborted) return isDeadline(signal) ? "timeout" : "cancelled";
  return "provider_error";
}

/**
 * OpenAI request options shared by every text call. `store: false`: we don't ask OpenAI to keep
 * the request as a stored response (ADR 0005). `promptCacheKey` groups requests that share a
 * prefix so they're likelier to land on the same cache (best-effort; measured in the ledger).
 */
export function openAIOptions(cacheKey?: string) {
  return {
    openai: {
      store: config.openai.store,
      strictJsonSchema: true,
      ...(cacheKey ? { promptCacheKey: `${config.openai.promptCacheKeyPrefix}-${cacheKey}` } : {}),
    },
  };
}

/** Removes delimiter tags from untrusted text so it can't close or open our prompt blocks. */
export function stripPromptTags(text: string): string {
  return text.replace(/<\s*\/?\s*(?:question|message|notes?|reference_data|article)\b[^>]*>/gi, "");
}

export const now = (): number => performance.now();
