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

  it("returns 'failed' when the database is down or hangs, never throws", async () => {
    const down: GapStore = {
      ...memoryGapStore().store,
      purgeOlderThan: async () => Promise.reject(new Error("ECONNREFUSED")),
    };
    expect(await saveGap(submission, down)).toEqual({ status: "failed" });
    const hanging: GapStore = { ...memoryGapStore().store, insert: () => new Promise(() => {}) };
    expect(await saveGap(submission, hanging, new Date(), 20)).toEqual({ status: "failed" });
  });
});

describe("gaps.deleteGapWithToken", () => {
  it("removes the row only with the matching token", async () => {
    const { store, rows } = memoryGapStore();
    const saved = await saveGap(submission, store);
    if (saved.status !== "saved") throw new Error(saved.status);
    expect(await deleteGapWithToken(saved.id, "wrong-token-wrong-token", store)).toEqual({
      status: "not_found",
    });
    expect(rows).toHaveLength(1);
    expect(await deleteGapWithToken(saved.id, saved.deleteToken, store)).toEqual({
      status: "deleted",
    });
    expect(rows).toHaveLength(0);
  });

  it("returns 'unavailable' without a database", async () => {
    expect(await deleteGapWithToken("x", "y", null)).toEqual({ status: "unavailable" });
  });
});
