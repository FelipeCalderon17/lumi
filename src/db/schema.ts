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

import { GAP_TOPICS } from "../server/gaps";
import { TERMINAL_EVENT_TYPES } from "../server/pipeline";

/**
 * Only two tables, on purpose (ADR 0005, 0006). Neither stores conversations,
 * names, IPs or user agents.
 */

export const languageEnum = pgEnum("language", ["en", "es"]);
export const gapTopicEnum = pgEnum("gap_topic", GAP_TOPICS);

/**
 * A question the assistant could not answer, saved with the parent's explicit consent after
 * an editable preview. Deleted after config.gaps.retentionDays (ADR 0005).
 */
export const gapQuestion = pgTable(
  "gap_question",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The text as edited by the parent in the preview. */
    question: text("question").notNull(),
    language: languageEnum("language").notNull(),
    /** Router-assigned topic label, for staff triage. */
    topic: gapTopicEnum("topic").notNull(),
    /** SHA-256 of the one-time delete token given to the parent. Never the token itself. */
    deleteTokenHash: text("delete_token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gap_question_created_at_idx").on(t.createdAt)],
);

export const pipelineStageEnum = pgEnum("pipeline_stage", ["router", "answer", "judge"]);
export const requestOutcomeEnum = pgEnum("request_outcome", [...TERMINAL_EVENT_TYPES, "cancelled"]);

/**
 * One row per model call, success or failure: numbers and enums only, never content.
 * Unknown token counts and costs are NULL, never 0.
 */
export const usageLedger = pgTable(
  "usage_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    stage: pipelineStageEnum("stage").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens"),
    cachedInputTokens: integer("cached_input_tokens"),
    outputTokens: integer("output_tokens"),
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 8 }),
    latencyMs: integer("latency_ms").notNull(),
    finishReason: text("finish_reason").notNull(),
    failureReason: text("failure_reason"),
    requestOutcome: requestOutcomeEnum("request_outcome").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("usage_ledger_created_at_idx").on(t.createdAt)],
);
