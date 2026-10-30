import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { ModelId } from "../server/config";
import type { GapRecord, GapStore } from "../server/gaps";
import type { UsageEntry, UsageLedger, UsageReader, UsageRow } from "../server/ledger";
import type { Db } from "./client";
import { gapQuestion, usageLedger } from "./schema";

/** Ledger writes: numbers and enums only (the entry type has no text field to leak). */
export function createDbLedger(db: Db): UsageLedger {
  return {
    async record(entry: UsageEntry) {
      await db.insert(usageLedger).values({
        requestId: entry.requestId,
        step: entry.step,
        model: entry.model,
        inputTokens: entry.inputTokens,
        cachedInputTokens: entry.cachedInputTokens,
        outputTokens: entry.outputTokens,
        reasoningTokens: entry.reasoningTokens,
        audioSeconds: entry.audioSeconds,
        latencyMs: entry.latencyMs,
        finishReason: entry.finishReason,
        failureReason: entry.failureReason,
        outcome: entry.outcome,
      });
    },
  };
}

export function createDbUsageReader(db: Db): UsageReader {
  return {
    async since(cutoff, limit): Promise<UsageRow[]> {
      const rows = await db
        .select({
          requestId: usageLedger.requestId,
          step: usageLedger.step,
          model: usageLedger.model,
          outcome: usageLedger.outcome,
          inputTokens: usageLedger.inputTokens,
          cachedInputTokens: usageLedger.cachedInputTokens,
          outputTokens: usageLedger.outputTokens,
          reasoningTokens: usageLedger.reasoningTokens,
          audioSeconds: usageLedger.audioSeconds,
          latencyMs: usageLedger.latencyMs,
        })
        .from(usageLedger)
        .where(gte(usageLedger.createdAt, cutoff))
        .orderBy(desc(usageLedger.createdAt))
        .limit(limit);
      // `model` is free text in the table; models no longer in the catalog price as "unknown".
      return rows.map((row) => ({ ...row, model: row.model as ModelId }));
    },
  };
}

export function createDbGapStore(db: Db): GapStore {
  return {
    async insert(row) {
      const inserted = await db
        .insert(gapQuestion)
        .values({ ...row, consent: true })
        .onConflictDoNothing({ target: gapQuestion.id })
        .returning({ id: gapQuestion.id });
      if (inserted.length > 0) return "inserted";
      const same = await db
        .select({ id: gapQuestion.id })
        .from(gapQuestion)
        .where(
          and(eq(gapQuestion.id, row.id), eq(gapQuestion.deleteTokenHash, row.deleteTokenHash)),
        )
        .limit(1);
      return same.length > 0 ? "exists" : "conflict";
    },
    async listRecent(limit): Promise<GapRecord[]> {
      return db
        .select({
          id: gapQuestion.id,
          question: gapQuestion.question,
          language: gapQuestion.language,
          topic: gapQuestion.topic,
          createdAt: gapQuestion.createdAt,
        })
        .from(gapQuestion)
        .orderBy(desc(gapQuestion.createdAt))
        .limit(limit);
    },
    async delete(id) {
      const deleted = await db
        .delete(gapQuestion)
        .where(eq(gapQuestion.id, id))
        .returning({ id: gapQuestion.id });
      return deleted.length > 0;
    },
    async deleteWithTokenHash(id, deleteTokenHash) {
      const deleted = await db
        .delete(gapQuestion)
        .where(and(eq(gapQuestion.id, id), eq(gapQuestion.deleteTokenHash, deleteTokenHash)))
        .returning({ id: gapQuestion.id });
      return deleted.length > 0;
    },
    async purgeOlderThan(cutoff) {
      const deleted = await db
        .delete(gapQuestion)
        .where(lt(gapQuestion.createdAt, cutoff))
        .returning({ id: gapQuestion.id });
      return deleted.length;
    },
  };
}
