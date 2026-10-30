import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Only two tables, on purpose (ADR 0005, 0006). Neither stores conversations,
 * names, IPs or user agents.
 */

export const languageEnum = pgEnum("language", ["en", "es"]);

/** A question the assistant could not answer, saved with the parent's explicit consent. */
export const gapQuestion = pgTable(
  "gap_question",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    question: text("question").notNull(),
    language: languageEnum("language").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gap_question_created_at_idx").on(t.createdAt)],
);

export const pipelineStageEnum = pgEnum("pipeline_stage", ["router", "answer", "judge"]);
export const ledgerOutcomeEnum = pgEnum("ledger_outcome", [
  "ok",
  "fallback",
  "abstained",
  "emergency",
  "error",
]);

/** One row per model call: numbers only, never content. */
export const usageLedger = pgTable(
  "usage_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    stage: pipelineStageEnum("stage").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull(),
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 8 }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    outcome: ledgerOutcomeEnum("outcome").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("usage_ledger_created_at_idx").on(t.createdAt)],
);
