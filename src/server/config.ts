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
  /** ISO date the numbers were last checked. `null` = not yet. */
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

const PRICE_SOURCE = "OpenAI launch pages + public pricing trackers";
const PRICES_VERIFIED_AT = "2026-10-30";

/**
 * Every model the app or the evals may call (ADR 0009, 0014), with its price.
 * The ledger stores token FACTS only; cost is derived from this catalog when it's read
 * (ADR 0013), so fixing a price here corrects every past estimate. The provider's invoice is
 * the truth; these only estimate it. Prices applied by Felipe after Codex review 3.
 */
export const modelCatalog = {
  "gpt-6-luna": {
    billing: "tokens",
    inputUsdPerMillion: 0.1,
    cachedInputUsdPerMillion: 0.01,
    outputUsdPerMillion: 0.5,
    source: PRICE_SOURCE,
    verifiedAt: PRICES_VERIFIED_AT,
  },
  "gpt-6.1-terra": {
    billing: "tokens",
    inputUsdPerMillion: 1,
    cachedInputUsdPerMillion: 0.05,
    outputUsdPerMillion: 5,
    source: PRICE_SOURCE,
    verifiedAt: PRICES_VERIFIED_AT,
  },
  "gpt-6-sol": {
    billing: "tokens",
    inputUsdPerMillion: 2,
    cachedInputUsdPerMillion: 0.2,
    outputUsdPerMillion: 10,
    source: PRICE_SOURCE,
    verifiedAt: PRICES_VERIFIED_AT,
  },
  "gpt-6.1-sol": {
    billing: "tokens",
    inputUsdPerMillion: 2,
    cachedInputUsdPerMillion: 0.1,
    outputUsdPerMillion: 10,
    source: PRICE_SOURCE,
    verifiedAt: PRICES_VERIFIED_AT,
  },
  "gpt-transcribe": {
    billing: "audio_duration",
    usdPerMinute: 0.0045,
    source: PRICE_SOURCE,
    verifiedAt: PRICES_VERIFIED_AT,
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
    /** Reading a JSON request body (≤ 160 KB). A body still arriving after this → 408. */
    bodyReadMs: 10_000,
    /** Reading an audio upload (≤ 4 MB, possibly on a slow mobile connection). */
    audioBodyReadMs: 30_000,
    /** How long we wait for a body stream's cancel() when giving up on it; never longer. */
    bodyCancelMs: 250,
  },

  limits: {
    /** Request bodies above this are rejected while reading, before JSON parsing. */
    maxRequestBytes: 8_192,
    /** Longer messages are rejected before any model call (after the safety pre-check). */
    maxInputChars: 1_000,
    /**
     * Output caps INCLUDE reasoning tokens on OpenAI reasoning models, so they leave headroom
     * for thinking. Visible length is set by the prompt (router: a tiny JSON object; answer:
     * ~180 words). Hitting a cap → fallback(truncated), never a cut-off answer.
     * Router 1,000 and answer 3,000 are approved by Felipe for now (Phase 2, after Codex
     * review 3); they'll be tuned in Phase 4 from the measured reasoning_tokens in the evals.
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
      /** Most two provider-reported durations may differ (rounding) before we distrust both. */
      durationAgreementSeconds: 2,
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
    /** Parent deletes write a tombstone, so they're bounded too; generous so privacy wins. */
    gapDeletes: { windowMs: 60 * 60_000, max: 30 },
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
    /**
     * The summary is aggregated in SQL over the WHOLE window (no row limit). Its only bound is
     * the number of step × model groups returned; above it the summary says `complete: false`.
     */
    usageMaxGroups: 100,
  },

  evals: {
    /**
     * The budget guard aborts a run whose *estimated* cost is above this before any call, and
     * stops a running eval before a call that could take the actual spend past it (ADR 0009).
     */
    budgetCapUsd: 2,
    /**
     * Answer arms in PRIORITY order: when the budget can't fit them all, the last ones are
     * dropped first. `gpt-6-sol` is last because it is also the judge (self-preference).
     */
    answerModels: ["gpt-6-luna", "gpt-6.1-terra", "gpt-6.1-sol", "gpt-6-sol"],
    runsPerCase: { "gpt-6-luna": 3, default: 1 },
    /**
     * Arms other than the first run only cases with one of these tags: the ones that can reach
     * the answer step. Safety cases end before the answer model, so the first arm covers them.
     */
    answerStepTags: [
      "practical",
      "not-in-kb",
      "injection",
      "unsupported-claim",
      "language-mismatch",
      "false-positive",
      "mixed-intent",
    ],
    /** Eval calls in flight at once. Each one reserves its worst-case cost first. */
    concurrency: 4,
    judge: {
      reasoning: "low",
      /**
       * Reasoning included. A judge call that hits it counts as a judge error, not a verdict.
       * The validation run measured 109–169 output tokens per call, so this is >10× headroom.
       */
      maxOutputTokens: 2_000,
      timeoutMs: 90_000,
    },
    /**
     * Runtime guard: what each call RESERVES before it's made. An upper bound, not an estimate:
     * input from the actual prompt text at a low chars/token (measured 4.5–4.8), plus a fixed
     * allowance for message framing and the structured-output schema, plus the full output cap,
     * times every allowed attempt (maxRetries + 1), with no cache discount.
     */
    guard: {
      charsPerToken: 3,
      requestOverheadTokens: 1_000,
    },
    /** Pre-run estimate only (the actual cost always comes from provider usage). */
    estimate: {
      /** Conservative: the measured answer prefix is 4.5–4.8 characters per token (EN/ES). */
      charsPerToken: 4,
      /**
       * Expected output (reasoning included) per call; the runtime guard reserves the caps.
       * Measured on gpt-6-luna (Phase 4 validation): router 22–44, answer 220–320, judge
       * 109–169. The answer stays high because the bigger arms may reason longer.
       */
      outputTokens: { router: 150, answer: 800, judge: 400, notebook: 300 },
      /** Share of a repeated prefix assumed cached in the "warm" estimate. */
      warmCachedShare: 0.9,
      /** OpenAI only caches prompts from this many tokens, so the router prompt never is. */
      minCacheablePrefixTokens: 1_024,
    },
  } satisfies {
    budgetCapUsd: number;
    answerModels: readonly ModelId[];
    runsPerCase: Partial<Record<ModelId, number>> & { default: number };
    answerStepTags: readonly string[];
    concurrency: number;
    judge: { reasoning: ReasoningEffort; maxOutputTokens: number; timeoutMs: number };
    guard: { charsPerToken: number; requestOverheadTokens: number };
    estimate: {
      charsPerToken: number;
      outputTokens: Record<"router" | "answer" | "judge" | "notebook", number>;
      warmCachedShare: number;
      minCacheablePrefixTokens: number;
    };
  },
} as const;
