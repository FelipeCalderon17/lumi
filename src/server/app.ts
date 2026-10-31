import { randomBytes } from "node:crypto";
import { createDb } from "../db/client";
import { createDbGapStore, createDbLedger, createDbUsageReader } from "../db/stores";
import { config } from "./config";
import type { GapStore } from "./gaps";
import { getKnowledgeBase } from "./knowledge";
import { createNoopLedger, type UsageLedger, type UsageReader } from "./ledger";
import { consoleLogger, type Logger } from "./log";
import { createOpenAIProvider, type ModelProvider } from "./models";
import type { ChatDeps } from "./pipeline";
import { createRateLimiter, type RateLimiter } from "./rate-limit";
import { readStaffAuthConfig, type StaffAuthConfig } from "./staff-auth";

/**
 * Composition root: builds the real dependencies once per process and hands them to the route
 * adapters. Tests never import this; they build deps from mocks.
 */
export type ServerDeps = {
  models: ModelProvider;
  ledger: UsageLedger;
  /** `null` without DATABASE_URL: gap save answers "not available in this demo". */
  gapStore: GapStore | null;
  usageReader: UsageReader | null;
  staffAuth: StaffAuthConfig;
  limiters: Record<
    "chat" | "gaps" | "gapDeletes" | "staffLogin" | "transcribe" | "notebook" | "modelCalls",
    RateLimiter
  >;
  /** Per-process salt for rate-limit keys; never persisted. */
  rateLimitSalt: string;
  log: Logger;
  chat: ChatDeps;
};

function limiter(opts: { windowMs: number; max: number }): RateLimiter {
  return createRateLimiter({ ...opts, maxKeys: config.rateLimit.maxTrackedKeys });
}

export function createServerDeps(
  env: Record<string, string | undefined> = process.env,
): ServerDeps {
  const models = createOpenAIProvider();
  // No DATABASE_URL → the chat still works; the ledger becomes a no-op (with one warning) and
  // gaps are unavailable. postgres.js connects lazily, so this never blocks startup.
  const db = env.DATABASE_URL ? createDb(env.DATABASE_URL) : null;
  const ledger = db ? createDbLedger(db) : createNoopLedger();
  const limiters = {
    chat: limiter(config.rateLimit.chat),
    gaps: limiter(config.rateLimit.gaps),
    gapDeletes: limiter(config.rateLimit.gapDeletes),
    staffLogin: limiter(config.rateLimit.staffLogin),
    transcribe: limiter(config.rateLimit.transcribe),
    notebook: limiter(config.rateLimit.notebook),
    modelCalls: limiter(config.rateLimit.modelCalls),
  };
  const log = consoleLogger;
  return {
    models,
    ledger,
    gapStore: db ? createDbGapStore(db) : null,
    usageReader: db ? createDbUsageReader(db) : null,
    staffAuth: readStaffAuthConfig(env),
    limiters,
    rateLimitSalt: randomBytes(16).toString("hex"),
    log,
    chat: {
      models: {
        router: models.language(config.models.router),
        answer: models.language(config.models.answer),
      },
      getKnowledgeBase,
      ledger,
      limiters: { chat: limiters.chat, modelCalls: limiters.modelCalls },
      log,
    },
  };
}

let deps: ServerDeps | undefined;

export function getServerDeps(): ServerDeps {
  deps ??= createServerDeps();
  return deps;
}
