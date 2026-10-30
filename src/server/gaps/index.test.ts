import { describe, expect, it } from "vitest";
import { GapSubmissionSchema, retentionCutoff } from "./index";

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

describe("gaps store (planned, Phase 3)", () => {
  it.todo("redacts emails and phone numbers before the preview");
  it.todo("purges rows older than the retention window on save and on list");
  it.todo("deleteWithToken removes the row only with the matching token");
});
