import { describe, expect, it } from "vitest";
import { GapSubmissionSchema } from "./index";

describe("gaps.GapSubmissionSchema (contract)", () => {
  it("requires explicit consent", () => {
    const base = { question: "Can siblings visit the ward?", language: "en" };
    expect(GapSubmissionSchema.safeParse({ ...base, consent: true }).success).toBe(true);
    expect(GapSubmissionSchema.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(GapSubmissionSchema.safeParse(base).success).toBe(false);
  });

  it("rejects empty and oversized questions", () => {
    expect(
      GapSubmissionSchema.safeParse({ question: "   ", language: "es", consent: true }).success,
    ).toBe(false);
    expect(
      GapSubmissionSchema.safeParse({ question: "a".repeat(5_000), language: "es", consent: true })
        .success,
    ).toBe(false);
  });

  it.todo("redacts emails and phone numbers before saving");
});
