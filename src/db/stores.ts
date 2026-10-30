import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { ModelId } from "../server/config";
import type { GapRecord, GapStore } from "../server/gaps";
import type { UsageEntry, UsageLedger, UsageReader } from "../server/ledger";
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

/** SUM over a nullable column; 0 when every value is NULL. Bigint sums arrive as strings. */
const total = (expression: ReturnType<typeof sql>) =>
  sql<number>`coalesce(sum(${expression}), 0)`.mapWith(Number);
const count = (condition: ReturnType<typeof sql>) =>
  sql<number>`count(*) filter (where ${condition})`.mapWith(Number);

/**
 * One row per step × model over every ledger row since `cutoff`: SUMs and COUNTs in SQL, no
 * row limit. LIMIT applies to groups only (maxGroups + 1, so the caller can tell it hit it).
 */
export function usageTotalsQuery(db: Db, cutoff: Date, maxGroups: number) {
  const u = usageLedger;
  const ratioRow = sql`${u.cachedInputTokens} is not null and ${u.inputTokens} > 0`;
  return db
    .select({
      step: u.step,
      model: u.model,
      calls: sql<number>`count(*)`.mapWith(Number),
      inputTokens: total(sql`${u.inputTokens}`),
      uncachedInputTokens: total(sql`greatest(${u.inputTokens} - ${u.cachedInputTokens}, 0)`),
      cachedInputTokens: total(sql`${u.cachedInputTokens}`),
      outputTokens: total(sql`${u.outputTokens}`),
      reasoningTokens: total(sql`${u.reasoningTokens}`),
      audioSeconds: total(sql`${u.audioSeconds}`),
      callsWithUnknownTokens: count(
        sql`${u.inputTokens} is null or ${u.cachedInputTokens} is null or ${u.outputTokens} is null`,
      ),
      callsWithUnknownAudio: count(sql`${u.audioSeconds} is null`),
      ratioInputTokens: total(sql`case when ${ratioRow} then ${u.inputTokens} end`),
      ratioCachedTokens: total(sql`case when ${ratioRow} then ${u.cachedInputTokens} end`),
    })
    .from(u)
    .where(gte(u.createdAt, cutoff))
    .groupBy(u.step, u.model)
    .orderBy(asc(u.step), asc(u.model))
    .limit(maxGroups + 1);
}

export function createDbUsageReader(db: Db): UsageReader {
  return {
    async totalsSince(cutoff, maxGroups) {
      const [groups, requests] = await Promise.all([
        usageTotalsQuery(db, cutoff, maxGroups),
        db
          .select({
            requests: sql<number>`count(distinct ${usageLedger.requestId})`.mapWith(Number),
          })
          .from(usageLedger)
          .where(gte(usageLedger.createdAt, cutoff)),
      ]);
      // `model` is free text in the table; models no longer in the catalog price as "unknown".
      return {
        requests: requests[0]?.requests ?? 0,
        groups: groups.map((g) => ({ ...g, model: g.model as ModelId })),
      };
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
