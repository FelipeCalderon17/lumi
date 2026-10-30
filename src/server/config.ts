/**
 * Single source of truth for every tunable in the AI pipeline.
 * If a number that affects cost, latency or safety lives anywhere else, move it here.
 */

export type ModelPrice = {
  /** USD per 1M tokens. `null` = unknown: cost is reported as unknown, never as 0. */
  inputUsdPerMillion: number | null;
  cachedInputUsdPerMillion: number | null;
  outputUsdPerMillion: number | null;
  /** Where the numbers came from. */
  source: string;
  /** ISO date the numbers were checked against platform.openai.com/pricing. `null` = not yet. */
  verifiedAt: string | null;
};

/**
 * Every model the app or the evals may call (ADR 0009). Prices only *estimate* cost in the
 * usage ledger and the eval budget guard; the provider's invoice is the truth.
 */
export const modelCatalog = {
  "gpt-6-luna": {
    inputUsdPerMillion: 0.1,
    cachedInputUsdPerMillion: 0.01,
    outputUsdPerMillion: 0.5,
    source: "Public reporting, Sep 2026 (placeholder). TODO: verify on platform.openai.com/pricing",
    verifiedAt: null,
  },
  "gpt-6.1-terra": {
    inputUsdPerMillion: null,
    cachedInputUsdPerMillion: null,
    outputUsdPerMillion: null,
    source: "Unknown. TODO: verify on platform.openai.com/pricing",
    verifiedAt: null,
  },
  "gpt-6-sol": {
    inputUsdPerMillion: 2,
    cachedInputUsdPerMillion: 0.2,
    outputUsdPerMillion: 10,
    source: "Public reporting, Sep 2026 (placeholder). TODO: verify on platform.openai.com/pricing",
    verifiedAt: null,
  },
  "gpt-6.1-sol": {
    inputUsdPerMillion: null,
    cachedInputUsdPerMillion: null,
    outputUsdPerMillion: null,
    source: "Unknown. TODO: verify on platform.openai.com/pricing",
    verifiedAt: null,
  },
} as const satisfies Record<string, ModelPrice>;

export type ModelId = keyof typeof modelCatalog;
export const MODEL_IDS = Object.keys(modelCatalog) as ModelId[];

export const config = {
  models: {
    /** Fixed on the cheapest model, also during the answer-model comparison (ADR 0009). */
    router: "gpt-6-luna",
    /** Provisional until the comparison in docs/EVALS.md is run (ADR 0009). */
    answer: "gpt-6-luna",
    /** LLM-as-judge for evals only. Not one of the cheap candidates, to limit self-preference. */
    judge: "gpt-6-sol",
  } satisfies Record<string, ModelId>,

  /** Per-stage deadlines, combined with the request's own AbortSignal (RequestContext). */
  timeouts: {
    /** Router is a tiny classification call; if it is slow, fail fast to the fallback. */
    routerMs: 4_000,
    /** Time allowed until the first token of the answer arrives (stall detection). */
    answerFirstTokenMs: 8_000,
    /** Hard ceiling for the whole (buffered) answer. */
    answerTotalMs: 25_000,
    /** Ledger writes are best-effort and abandoned after this, after the response is sent. */
    ledgerWriteMs: 1_500,
    /** Gap save / staff list database calls. */
    dbMs: 3_000,
  },

  limits: {
    /** Request bodies above this are rejected while reading, before JSON parsing. */
    maxRequestBytes: 8_192,
    /** Longer messages are rejected before any model call (after the safety pre-check). */
    maxInputChars: 1_000,
    maxRouterOutputTokens: 80,
    maxAnswerOutputTokens: 600,
  },

  /**
   * In-memory, per instance (ADR 0006). Windows are fixed; expired keys are swept and the
   * key table is capped so memory stays bounded. Emergencies are never rate-limited.
   */
  rateLimit: {
    chat: { windowMs: 60_000, max: 10 },
    gaps: { windowMs: 60 * 60_000, max: 5 },
    staffLogin: { windowMs: 15 * 60_000, max: 5 },
    /** Instance-wide ceiling on model calls (router + answer), regardless of client. */
    modelCalls: { windowMs: 60_000, max: 120 },
    maxTrackedKeys: 10_000,
  },

  /**
   * Client IP for rate-limit keys. Railway's edge proxy appends the address it saw to
   * X-Forwarded-For, so the right-most entry is the only one we can trust; everything to its
   * left is client-controlled. See docs/ARCHITECTURE.md § Abuse controls.
   */
  clientIp: {
    trustedProxyHops: 1,
  },

  /**
   * The ONLY retry layer: passed as `maxRetries` to the AI SDK.
   * Do not wrap model calls in another retry loop (retries multiply cost and latency).
   */
  retry: {
    maxRetries: 1,
  },

  gaps: {
    /** Saved questions are deleted after this many days (ADR 0005). */
    retentionDays: 30,
  },

  staff: {
    sessionTtlMs: 8 * 60 * 60_000,
    cookieName: "lumi_staff",
    /** STAFF_SESSION_SECRET shorter than this → staff area stays closed (ADR 0008). */
    minSecretLength: 32,
  },

  evals: {
    /** The budget guard aborts a run whose *estimated* cost is above this (ADR 0009). */
    budgetCapUsd: 2,
    answerModels: ["gpt-6-luna", "gpt-6.1-terra", "gpt-6-sol", "gpt-6.1-sol"],
    runsPerCase: { "gpt-6-luna": 3, default: 1 },
  } satisfies {
    budgetCapUsd: number;
    answerModels: readonly ModelId[];
    runsPerCase: Partial<Record<ModelId, number>> & { default: number };
  },
} as const;
