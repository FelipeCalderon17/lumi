import { describe, expect, it } from "vitest";
import { memoryGapStore } from "../test-helpers";
import {
  deleteGapWithToken,
  type GapStore,
  GapSubmissionSchema,
  hashDeleteToken,
  listGapsForStaff,
  redactContactDetails,
  retentionCutoff,
  saveGap,
} from "./index";

const base = {
  question: "Can siblings visit the ward?",
  language: "en",
  topic: "family-and-school",
};

describe("gaps.GapSubmissionSchema (contract)", () => {
  it("requires explicit consent", () => {
    expect(GapSubmissionSchema.safeParse({ ...base, consent: true }).success).toBe(true);
    expect(GapSubmissionSchema.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(GapSubmissionSchema.safeParse(base).success).toBe(false);
  });

  it("rejects empty and oversized questions", () => {
    expect(GapSubmissionSchema.safeParse({ ...base, question: "   ", consent: true }).success).toBe(
      false,
    );
    expect(
      GapSubmissionSchema.safeParse({ ...base, question: "a".repeat(5_000), consent: true })
        .success,
    ).toBe(false);
  });

  it("requires a known topic label and rejects extra fields (no names, no conversation)", () => {
    expect(GapSubmissionSchema.safeParse({ ...base, topic: "x", consent: true }).success).toBe(
      false,
    );
    expect(GapSubmissionSchema.safeParse({ ...base, consent: true, name: "someone" }).success).toBe(
      false,
    );
  });
});

describe("gaps.retentionCutoff", () => {
  it("is retentionDays before now (30 by default)", () => {
    const now = new Date("2026-10-30T12:00:00Z");
    expect(retentionCutoff(now).toISOString()).toBe("2026-09-30T12:00:00.000Z");
    expect(retentionCutoff(now, 1).toISOString()).toBe("2026-10-29T12:00:00.000Z");
  });
});

describe("gaps.redactContactDetails", () => {
  it("removes emails and phone numbers, in the gap's language", () => {
    expect(
      redactContactDetails("Write me at ana.perez@example.com or 555-123-4567 please", "en"),
    ).toBe("Write me at [email removed] or [phone removed] please");
    expect(redactContactDetails("Llámame al (555) 123 4567", "es")).toBe(
      "Llámame al [teléfono eliminado]",
    );
  });

  it("keeps ordinary numbers and 911", () => {
    expect(redactContactDetails("My son is 7, room 412. Call 911 if needed.")).toBe(
      "My son is 7, room 412. Call 911 if needed.",
    );
  });
});

const submission = {
  question: "Can our dog visit? Email me at a@b.co",
  language: "en" as const,
  topic: "hospital-logistics" as const,
  consent: true as const,
};

describe("gaps.saveGap", () => {
  it("stores the redacted text with only the hash of a one-time delete token", async () => {
    const { store, rows } = memoryGapStore();
    const saved = await saveGap(submission, store);
    if (saved.status !== "saved") throw new Error(saved.status);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.question).toBe("Can our dog visit? Email me at [email removed]");
    expect(rows[0]?.deleteTokenHash).toBe(hashDeleteToken(saved.deleteToken));
    expect(JSON.stringify(rows)).not.toContain(saved.deleteToken);
  });

  it("purges rows older than the retention window on save and on list", async () => {
    let now = new Date("2026-09-01T00:00:00Z");
    const { store, rows } = memoryGapStore(() => now);
    await saveGap(submission, store, now);
    now = new Date("2026-10-30T00:00:00Z");
    await saveGap(submission, store, now);
    expect(rows).toHaveLength(1);

    now = new Date("2026-12-15T00:00:00Z");
    expect(await listGapsForStaff(store, now)).toEqual([]);
  });

  it("returns 'unavailable' without a database (demo mode)", async () => {
    expect(await saveGap(submission, null)).toEqual({ status: "unavailable" });
  });

  it("returns 'failed' when nothing was written (purge fails or hangs), never throws", async () => {
    const down: GapStore = {
      ...memoryGapStore().store,
      purgeOlderThan: async () => Promise.reject(new Error("ECONNREFUSED")),
    };
    expect(await saveGap(submission, down)).toEqual({ status: "failed" });
    const hangingPurge: GapStore = {
      ...memoryGapStore().store,
      purgeOlderThan: () => new Promise(() => {}),
    };
    expect(await saveGap(submission, hangingPurge, new Date(), 20)).toEqual({ status: "failed" });
  });

  it("an insert that errors or hangs → 'uncertain' WITH the id and delete token", async () => {
    for (const insert of [
      () => new Promise<never>(() => {}),
      async () => Promise.reject(new Error("connection reset")),
    ]) {
      const store: GapStore = { ...memoryGapStore().store, insert };
      const saved = await saveGap(submission, store, new Date(), 20);
      expect(saved).toEqual({
        status: "uncertain",
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        deleteToken: expect.any(String),
      });
    }
  });

  it("regression (Codex review 3): a commit that lands after the timeout can still be deleted", async () => {
    const memory = memoryGapStore();
    let committed: Promise<unknown> = Promise.resolve();
    const slow: GapStore = {
      ...memory.store,
      insert: (row) => {
        // The database commits 50 ms later; saveGap stops waiting after 20 ms.
        committed = new Promise((resolve) => setTimeout(resolve, 50)).then(() =>
          memory.store.insert(row),
        );
        return committed as Promise<"inserted">;
      },
    };
    const saved = await saveGap(submission, slow, new Date(), 20);
    if (saved.status !== "uncertain") throw new Error(saved.status);
    expect(memory.rows).toHaveLength(0);
    await committed;
    expect(memory.rows).toHaveLength(1);
    expect(memory.rows[0]?.id).toBe(saved.id);
    expect(await deleteGapWithToken(saved.id, saved.deleteToken, memory.store)).toEqual({
      status: "deleted",
    });
    expect(await memory.store.listRecent(10)).toEqual([]);
    expect(memory.rows.filter((r) => r.question !== "")).toEqual([]);
  });

  it("regression (Codex re-review 3): a delete BEFORE the delayed commit wins; the question never stays", async () => {
    const memory = memoryGapStore();
    let committed: Promise<unknown> = Promise.resolve();
    const slow: GapStore = {
      ...memory.store,
      insert: (row) => {
        // The database commits 45 ms later; saveGap stops waiting after 10 ms.
        committed = new Promise((resolve) => setTimeout(resolve, 45)).then(() =>
          memory.store.insert(row),
        );
        return committed as Promise<"inserted">;
      },
    };
    const saved = await saveGap(submission, slow, new Date(), 10);
    if (saved.status !== "uncertain") throw new Error(saved.status);
    // The parent deletes while the insert is still in flight.
    expect(await deleteGapWithToken(saved.id, saved.deleteToken, memory.store, 10)).toEqual({
      status: "deleted",
    });
    expect(await committed).toBe("deleted"); // the late insert hit the tombstone
    expect(await memory.store.listRecent(10)).toEqual([]);
    expect(memory.rows.filter((r) => r.question !== "")).toEqual([]);
    // A retry with the same credentials can't bring it back either.
    const retry = { id: saved.id, deleteToken: saved.deleteToken };
    expect(await saveGap({ ...submission, retry }, memory.store)).toEqual({ status: "failed" });
    expect(await memory.store.listRecent(10)).toEqual([]);
  });

  it("a delete AFTER the commit blanks the stored question", async () => {
    const memory = memoryGapStore();
    const saved = await saveGap(submission, memory.store);
    if (saved.status !== "saved") throw new Error(saved.status);
    expect(await deleteGapWithToken(saved.id, saved.deleteToken, memory.store)).toEqual({
      status: "deleted",
    });
    expect(await memory.store.listRecent(10)).toEqual([]);
    expect(memory.rows.map((r) => [r.question, r.deleted])).toEqual([["", true]]);
  });

  it("tombstones are purged with the same retention", async () => {
    let now = new Date("2026-09-01T00:00:00Z");
    const memory = memoryGapStore(() => now);
    await deleteGapWithToken(crypto.randomUUID(), "x".repeat(32), memory.store);
    expect(memory.rows).toHaveLength(1);
    now = new Date("2026-10-30T00:00:00Z");
    await saveGap(submission, memory.store, now);
    expect(memory.rows.filter((r) => r.deleted)).toEqual([]);
  });

  it("retrying with the same id and token is idempotent: one row, same credentials", async () => {
    const { store, rows } = memoryGapStore();
    const first = await saveGap(submission, store);
    if (first.status !== "saved") throw new Error(first.status);
    const retry = { id: first.id, deleteToken: first.deleteToken };
    expect(await saveGap({ ...submission, retry }, store)).toEqual({ status: "saved", ...retry });
    expect(rows).toHaveLength(1);
  });

  it("regression (Codex re-review 4): a staff delete from a stale list keeps the tombstone", async () => {
    const memory = memoryGapStore();
    const saved = await saveGap(submission, memory.store);
    if (saved.status !== "saved") throw new Error(saved.status);
    const staleList = await listGapsForStaff(memory.store);
    expect(staleList.map((g) => g.id)).toEqual([saved.id]);
    // The parent deletes; then staff deletes the same id from the list they loaded earlier.
    expect(await deleteGapWithToken(saved.id, saved.deleteToken, memory.store)).toEqual({
      status: "deleted",
    });
    expect(await memory.store.delete(staleList[0]?.id ?? "")).toBe(true);
    // A retry with the original credentials can't bring the question back.
    const retry = { id: saved.id, deleteToken: saved.deleteToken };
    expect(await saveGap({ ...submission, retry }, memory.store)).toEqual({ status: "failed" });
    expect(memory.rows.map((r) => [r.id, r.question, r.deleted])).toEqual([[saved.id, "", true]]);
    expect(await listGapsForStaff(memory.store)).toEqual([]);
  });

  it("a staff delete alone is a tombstone too: the id and token hash stay, the question goes", async () => {
    const memory = memoryGapStore();
    const saved = await saveGap(submission, memory.store);
    if (saved.status !== "saved") throw new Error(saved.status);
    expect(await memory.store.delete(saved.id)).toBe(true);
    expect(memory.rows.map((r) => [r.question, r.deleted, r.deleteTokenHash])).toEqual([
      ["", true, hashDeleteToken(saved.deleteToken)],
    ]);
    const retry = { id: saved.id, deleteToken: saved.deleteToken };
    expect(await saveGap({ ...submission, retry }, memory.store)).toEqual({ status: "failed" });
    expect(await memory.store.delete(crypto.randomUUID())).toBe(false);
  });

  it("a retry id that belongs to another row writes nothing → 'failed'", async () => {
    const { store, rows } = memoryGapStore();
    const first = await saveGap(submission, store);
    if (first.status !== "saved") throw new Error(first.status);
    const hijack = { id: first.id, deleteToken: "someone-elses-token-123" };
    expect(await saveGap({ ...submission, retry: hijack }, store)).toEqual({ status: "failed" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deleteTokenHash).toBe(hashDeleteToken(first.deleteToken));
  });

  it("the retry field is strict: a uuid id and a token of the right length", () => {
    const parse = (retry: unknown) =>
      GapSubmissionSchema.safeParse({ ...submission, retry }).success;
    expect(parse({ id: "00000000-0000-4000-8000-000000000001", deleteToken: "x".repeat(32) })).toBe(
      true,
    );
    expect(parse({ id: "nope", deleteToken: "x".repeat(32) })).toBe(false);
    expect(parse({ id: "00000000-0000-4000-8000-000000000001", deleteToken: "short" })).toBe(false);
  });
});

describe("gaps.deleteGapWithToken", () => {
  it("removes the question only with the matching token", async () => {
    const { store, rows } = memoryGapStore();
    const saved = await saveGap(submission, store);
    if (saved.status !== "saved") throw new Error(saved.status);
    expect(await deleteGapWithToken(saved.id, "wrong-token-wrong-token", store)).toEqual({
      status: "not_found",
    });
    expect(rows.map((r) => r.deleted)).toEqual([false]);
    expect(rows[0]?.question).not.toBe("");
    expect(await deleteGapWithToken(saved.id, saved.deleteToken, store)).toEqual({
      status: "deleted",
    });
    expect(await store.listRecent(10)).toEqual([]);
    expect(rows.map((r) => [r.question, r.deleted])).toEqual([["", true]]);
  });

  it("returns 'unavailable' without a database", async () => {
    expect(await deleteGapWithToken("x", "y", null)).toEqual({ status: "unavailable" });
  });
});
