/**
 * Single source of truth for every tunable in the AI pipeline.
 * If a number that affects cost, latency or safety lives anywhere else, move it here.
 */

/** Token-billed models (text). USD per 1M tokens; `null` = unknown, never 0. */
export type TokenPrice = {
  billing: "tokens";
  inputUsdPerMillion: number | null;
  cachedInputUsdPerMillion: number | null;
  /** Reasoning tokens are billed as output tokens (they're included in `outputTokens`). */
  outputUsdPerMillion: number | null;
  /** Where the numbers came from. */
  source: string;
  /** ISO date the numbers were checked against platform.openai.com/pricing. `null` = not yet. */
  verifiedAt: string | null;
};

/** Duration-billed models (transcription). `null` = unknown, never 0. */
export type AudioPrice = {
  billing: "audio_duration";
  usdPerMinute: number | null;
  source: string;
  verifiedAt: string | null;
};

export type ModelPrice = TokenPrice | AudioPrice;

/**
 * Every model the app or the evals may call (ADR 0009, 0014), with its price.
 * The ledger stores token FACTS only; cost is derived from this catalog when it's read
 * (ADR 0013), so fixing a price here corrects every past estimate. The provider's invoice is
 * the truth; these only estimate it.
 */
export const modelCatalog = {
  "gpt-6-luna": {
    billing: "tokens",
    inputUsdPerMillion: 0.1,
    cachedInputUsdPerMillion: 0.01,
    outputUsdPerMillion: 0.5,
    source: "Public reporting, Sep 2026 (placeholder). TODO: verify on platform.openai.com/pricing",
    verifiedAt: null,
  },
  "gpt-6.1-terra": {
    billing: "tokens",
    inputUsdPerMillion: null,
    cachedInputUsdPerMillion: null,
    outputUsdPerMillion: null,
    source: "Unknown. TODO: verify on platform.openai.com/pricing",
    verifiedAt: null,
  },
  "gpt-6-sol": {
    billing: "tokens",
    inputUsdPerMillion: 2,
    cachedInputUsdPerMillion: 0.2,
    outputUsdPerMillion: 10,
    source: "Public reporting, Sep 2026 (placeholder). TODO: verify on platform.openai.com/pricing",
    verifiedAt: null,
  },
  "gpt-6.1-sol": {
    billing: "tokens",
    inputUsdPerMillion: null,
    cachedInputUsdPerMillion: null,
    outputUsdPerMillion: null,
    source: "Unknown. TODO: verify on platform.openai.com/pricing",
    verifiedAt: null,
  },
  "gpt-transcribe": {
    billing: "audio_duration",
    usdPerMinute: null,
    source:
      "Unknown. Duration-billed per @ai-sdk/openai 4.0.104 changelog. TODO: verify on platform.openai.com/pricing",
    verifiedAt: null,
  },
} as const satisfies Record<string, ModelPrice>;

export type PriceCatalog = Readonly<Record<ModelId, ModelPrice>>;

export type ModelId = keyof typeof modelCatalog;
export const MODEL_IDS = Object.keys(modelCatalog) as ModelId[];

/** Reasoning effort levels accepted by the AI SDK's top-level `reasoning` option. */
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high";

export const config = {
  models: {
    /** Fixed on the cheapest model, also during the answer-model comparison (ADR 0009). */
    router: "gpt-6-luna",
    /** Provisional until the comparison in docs/EVALS.md is run (ADR 0009). */
    answer: "gpt-6-luna",
    /** Notebook structuring: organise and rephrase only, so the cheap model is enough. */
    notebook: "gpt-6-luna",
    /** Voice → text (ADR 0014). */
    transcribe: "gpt-transcribe",
    /** LLM-as-judge for evals only. Not one of the cheap candidates, to limit self-preference. */
    judge: "gpt-6-sol",
  } satisfies Record<string, ModelId>,

  reasoning: {
    /** Classification: little thinking needed, latency matters most. */
    router: "low",
    /** Grounded answer with citations. Tune with the evals (ADR 0009). */
    answer: "medium",
    notebook: "low",
  } satisfies Record<string, ReasoningEffort>,

  /**
   * OpenAI request options for every text call. `store: false` keeps the provider from
   * retaining the request as a stored response (ADR 0005: no conversation storage on our
   * side, and none we ask for on theirs). The prompt cache keys group requests that share a
   * prefix so they're more likely to hit the same cache (best-effort, measured).
   */
  openai: {
    store: false,
    promptCacheKeyPrefix: "lumi",
  },

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
    /** Gap save / staff list database calls (app-side wait). */
    dbMs: 3_000,
    /**
     * Postgres `statement_timeout` for every statement. Below dbMs, so the database cancels a
     * slow statement before the app stops waiting for it; a gap insert that still outlives the
     * app's wait is reported as `uncertain` with its id and delete token.
     */
    dbStatementMs: 2_500,
    /** Notebook structuring: one structured call over up to maxNotes notes. */
    notebookMs: 30_000,
    /** One transcription call for up to maxAudioSeconds of audio. */
    transcribeMs: 30_000,
  },

  limits: {
    /** Request bodies above this are rejected while reading, before JSON parsing. */
    maxRequestBytes: 8_192,
    /** Longer messages are rejected before any model call (after the safety pre-check). */
    maxInputChars: 1_000,
    /**
     * Output caps INCLUDE reasoning tokens on OpenAI reasoning models, so they leave headroom
     * for thinking. Visible length is set by the prompt (router: a tiny JSON object; answer:
     * ~180 words). Hitting a cap → fallback(truncated), never a cut-off answer. Tune from the
     * measured reasoning_tokens in the ledger/evals.
     */
    maxRouterOutputTokens: 1_000,
    maxAnswerOutputTokens: 3_000,
    maxNotebookOutputTokens: 4_000,
    notebook: {
      maxNotes: 40,
      maxNoteChars: 800,
      /** 40 × 800 chars × 4 bytes (worst-case UTF-8) + JSON overhead. */
      maxRequestBytes: 160_000,
    },
    audio: {
      /** Hard cap on recording length (ADR 0014). */
      maxSeconds: 120,
      /** 2 min at up to ~256 kbps. The client records at a lower bitrate (Phase 3). */
      maxBytes: 4 * 1024 * 1024,
      /** Containers MediaRecorder produces (Chrome/Firefox: webm, Safari: mp4) + m4a uploads. */
      mediaTypes: ["audio/webm", "audio/mp4", "audio/m4a", "audio/x-m4a"],
    },
  },

  /**
   * In-memory, per instance (ADR 0006). Windows are fixed; expired keys are swept and the
   * key table is capped so memory stays bounded. Emergencies are never rate-limited.
   */
  rateLimit: {
    chat: { windowMs: 60_000, max: 10 },
    gaps: { windowMs: 60 * 60_000, max: 5 },
    staffLogin: { windowMs: 15 * 60_000, max: 5 },
    transcribe: { windowMs: 60 * 60_000, max: 30 },
    notebook: { windowMs: 60 * 60_000, max: 10 },
    /** Instance-wide ceiling on model calls (router, answer, notebook, transcribe). */
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
    /** Most rows the staff list returns. */
    listLimit: 200,
  },

  staff: {
    sessionTtlMs: 8 * 60 * 60_000,
    cookieName: "lumi_staff",
    /** STAFF_SESSION_SECRET shorter than this → staff area stays closed (ADR 0008). */
    minSecretLength: 32,
    /** The staff usage summary covers this many days of ledger rows. */
    usageWindowDays: 30,
    /** Upper bound on ledger rows read for the summary (keeps the query bounded). */
    usageMaxRows: 20_000,
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
