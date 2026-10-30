import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import type { Db } from "./client";
import * as schema from "./schema";
import { usageTotalsQuery } from "./stores";

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
