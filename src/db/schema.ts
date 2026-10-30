import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { GAP_TOPICS } from "../server/gaps";
import { LEDGER_OUTCOMES } from "../server/ledger";
import { MODEL_STEPS } from "../server/types";

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
    /** The text as edited by the parent in the preview (contact details redacted). */
    question: text("question").notNull(),
    language: languageEnum("language").notNull(),
    /** Router-assigned topic label, for staff triage. */
    topic: gapTopicEnum("topic").notNull(),
    /** The parent ticked "Lumi staff can read this". Rows without consent can't exist. */
    consent: boolean("consent").notNull(),
    /** SHA-256 of the one-time delete token given to the parent. Never the token itself. */
    deleteTokenHash: text("delete_token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("gap_question_created_at_idx").on(t.createdAt),
    check("gap_question_consent_given", sql`${t.consent} = true`),
  ],
);

export const modelStepEnum = pgEnum("model_step", MODEL_STEPS);
export const ledgerOutcomeEnum = pgEnum("ledger_outcome", LEDGER_OUTCOMES);

/**
 * One row per model call, success or failure: numbers and enums only, never content.
 * Token FACTS only, no cost column (ADR 0013): cost is derived on read from the price catalog
 * in config, so a price change corrects every past estimate.
 * Unknown counts are NULL, never 0.
 */
export const usageLedger = pgTable(
  "usage_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    step: modelStepEnum("step").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens"),
    cachedInputTokens: integer("cached_input_tokens"),
    outputTokens: integer("output_tokens"),
    reasoningTokens: integer("reasoning_tokens"),
    /** Transcription only. */
    audioSeconds: real("audio_seconds"),
    latencyMs: integer("latency_ms").notNull(),
    finishReason: text("finish_reason").notNull(),
    failureReason: text("failure_reason"),
    outcome: ledgerOutcomeEnum("outcome").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("usage_ledger_created_at_idx").on(t.createdAt),
    index("usage_ledger_request_id_idx").on(t.requestId),
  ],
);
