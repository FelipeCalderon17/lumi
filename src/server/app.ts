import { randomBytes } from "node:crypto";
import { config } from "./config";
import { getKnowledgeBase } from "./knowledge";
import { createNoopLedger, type UsageLedger } from "./ledger";
import { consoleLogger, type Logger } from "./log";
import { createOpenAIProvider, type ModelProvider } from "./models";
import type { ChatDeps } from "./pipeline";
import { createRateLimiter, type RateLimiter } from "./rate-limit";

/**
 * Composition root: builds the real dependencies once per process and hands them to the route
 * adapters. Tests never import this; they build deps from mocks.
 */
export type ServerDeps = {
  models: ModelProvider;
  ledger: UsageLedger;
  limiters: Record<
    "chat" | "gaps" | "staffLogin" | "transcribe" | "notebook" | "modelCalls",
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

export function createServerDeps(): ServerDeps {
  const models = createOpenAIProvider();
  const ledger = createNoopLedger();
  const limiters = {
    chat: limiter(config.rateLimit.chat),
    gaps: limiter(config.rateLimit.gaps),
    staffLogin: limiter(config.rateLimit.staffLogin),
    transcribe: limiter(config.rateLimit.transcribe),
    notebook: limiter(config.rateLimit.notebook),
    modelCalls: limiter(config.rateLimit.modelCalls),
  };
  const log = consoleLogger;
  return {
    models,
    ledger,
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
