/**
 * Single source of truth for every tunable in the AI pipeline.
 * If a number that affects cost, latency or safety lives anywhere else, move it here.
 */
export const config = {
  models: {
    router: "gpt-6-luna",
    answer: "gpt-6-luna",
    judge: "gpt-6-luna",
  },

  timeouts: {
    /** Router is a tiny classification call; if it is slow, fail fast to the fallback. */
    routerMs: 4_000,
    /** Time allowed until the first streamed token of the answer. */
    answerFirstTokenMs: 8_000,
    /** Hard ceiling for the whole answer stream. */
    answerTotalMs: 30_000,
  },

  limits: {
    /** Longer messages are rejected before any model call. */
    maxInputChars: 1_000,
    maxRouterOutputTokens: 60,
    maxAnswerOutputTokens: 600,
  },

  /** In-memory, per instance (see ADR 0006). */
  rateLimit: {
    windowMs: 60_000,
    maxRequestsPerWindow: 10,
  },

  /**
   * The ONLY retry layer: passed as `maxRetries` to the AI SDK.
   * Do not wrap model calls in another retry loop (retries multiply cost and latency).
   */
  retry: {
    maxRetries: 1,
  },

  /**
   * USD per 1M tokens, used only to *estimate* cost in the usage ledger.
   * TODO(phase-1): placeholders — verify against OpenAI's pricing page for gpt-6-luna.
   */
  pricingUsdPerMillionTokens: {
    "gpt-6-luna": { input: 0, cachedInput: 0, output: 0 },
  },
} as const;

export type ModelId = (typeof config.models)[keyof typeof config.models];
