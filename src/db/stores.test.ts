import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import type { Db } from "./client";
import * as schema from "./schema";
import {
  createDbGapStore,
  gapInsertQuery,
  gapStaffDeleteQuery,
  gapTombstoneQuery,
  usageTotalsQuery,
} from "./stores";

describe("db.usageTotalsQuery (staff usage, Codex review 3)", () => {
  it("aggregates the whole window in SQL: GROUP BY step, model; LIMIT on groups only", () => {
    const db = drizzle.mock({ schema }) as unknown as Db;
    const { sql, params } = usageTotalsQuery(db, new Date("2026-09-30T00:00:00Z"), 100).toSQL();
    expect(sql).toMatch(/sum\(/);
    expect(sql).toMatch(/count\(\*\) filter \(where/);
    expect(sql).toMatch(/group by "usage_ledger"\."step", "usage_ledger"\."model"/);
    expect(sql).toMatch(/where "usage_ledger"\."created_at" >= \$1/);
    expect(sql).toMatch(/limit \$2$/);
    expect(params).toEqual([expect.any(String), 101]);
    // No per-row columns are read: no request id, latency or content.
    expect(sql).not.toMatch(/"request_id"|"latency_ms"/);
  });
});

describe("db gap store: delete vs. a save in flight (Codex re-review 3)", () => {
  const db = drizzle.mock({ schema }) as unknown as Db;
  const id = "00000000-0000-4000-8000-000000000001";

  it("parent delete is ONE upsert on the primary key: tombstone if absent, blank if present", () => {
    const { sql, params } = gapTombstoneQuery(db, id, "hash-a").toSQL();
    expect(sql).toMatch(/^insert into "gap_question"/);
    expect(sql).toMatch(
      /on conflict \("id"\) do update set "question" = \$\d+, "topic" = \$\d+, "deleted" = \$\d+ where "gap_question"\."delete_token_hash" = excluded\.delete_token_hash/,
    );
    expect(sql).toMatch(/returning "id"$/);
    expect(params).toContain(id);
    expect(params).toContain("hash-a");
    expect(params).toContain(true); // deleted
    // The tombstone carries no question text.
    expect(params.filter((p) => typeof p === "string" && p.length > 0 && p !== id)).not.toContain(
      "Where do we park?",
    );
  });

  it("save never overwrites: ON CONFLICT (id) DO NOTHING, so a tombstone that got there first wins", () => {
    const { sql } = gapInsertQuery(db, {
      id,
      question: "Where do we park?",
      language: "en",
      topic: "hospital-logistics",
      deleteTokenHash: "hash-a",
    }).toSQL();
    expect(sql).toMatch(/on conflict \("id"\) do nothing returning "id"$/);
    expect(sql).not.toMatch(/do update/);
  });

  it("staff delete is a soft tombstone (Codex re-review 4): UPDATE, never DELETE", () => {
    const { sql, params } = gapStaffDeleteQuery(db, id).toSQL();
    expect(sql).toMatch(
      /^update "gap_question" set "question" = \$\d+, "topic" = \$\d+, "deleted" = \$\d+ where "gap_question"\."id" = \$\d+ returning "id"$/,
    );
    expect(sql).not.toMatch(/delete from/i);
    expect(params).toEqual(["", "other", true, id]);
  });

  it("only the retention purge physically deletes rows", async () => {
    const executed: string[] = [];
    const spy = drizzle.mock({
      schema,
      logger: { logQuery: (query: string) => void executed.push(query) },
    }) as unknown as Db;
    const store = createDbGapStore(spy);
    await store.delete(id).catch(() => {});
    await store.deleteWithTokenHash(id, "hash-a").catch(() => {});
    expect(executed.join("\n")).not.toMatch(/^delete/im);
    await store.purgeOlderThan(new Date()).catch(() => {});
    expect(executed.at(-1)).toMatch(
      /^delete from "gap_question" where "gap_question"\."created_at" < \$1/,
    );
  });

  it("the staff list never shows tombstones", async () => {
    const executed: string[] = [];
    const spy = drizzle.mock({
      schema,
      logger: { logQuery: (query: string) => void executed.push(query) },
    }) as unknown as Db;
    await createDbGapStore(spy)
      .listRecent(10)
      .catch(() => {});
    expect(executed.join("\n")).toMatch(/where "gap_question"\."deleted" = \$1/);
  });
});
