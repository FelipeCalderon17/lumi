import { describe, expect, it } from "vitest";
import { ABSTAIN_MARKER, interpretCompletion } from "./index";

describe("answer (contract)", () => {
  it("uses a marker that cannot be confused with a citation handle", () => {
    expect(ABSTAIN_MARKER).not.toMatch(/^\[\d+\]$/);
  });

  it.todo("buildSystemPrefix is byte-identical for the same KB (cache-friendly)");
  it.todo("buildSystemPrefix wraps the KB in a reference-data block marked as data");
  it.todo("the question is never part of the system prefix");
});

describe("answer.interpretCompletion (completion semantics)", () => {
  it("accepts a complete answer", () => {
    expect(interpretCompletion("  Bring a phone charger [1].  ", "stop")).toEqual({
      ok: true,
      value: { kind: "answer", text: "Bring a phone charger [1]." },
    });
  });

  it("rejects a truncated answer even if it looks fine", () => {
    expect(interpretCompletion("Bring a phone charger [1] and", "length")).toEqual({
      ok: false,
      reason: "truncated",
    });
  });

  it("rejects interrupted, errored or filtered completions", () => {
    for (const reason of ["interrupted", "error", "other", "content-filter", "none"] as const) {
      expect(interpretCompletion("Bring a charger [1].", reason)).toEqual({
        ok: false,
        reason: "interrupted",
      });
    }
  });

  it("recognises the abstain marker after buffering, even if it arrived split", () => {
    const chunks = ["[[NO_", "ANSWER]]", " I don't have that."];
    expect(interpretCompletion(chunks.join(""), "stop")).toEqual({
      ok: true,
      value: { kind: "abstained" },
    });
    expect(interpretCompletion(`\n ${ABSTAIN_MARKER}`, "stop").ok).toBe(true);
  });

  it("treats a marker in the middle, or an empty reply, as invalid", () => {
    expect(interpretCompletion(`Parking is on level 2 [1]. ${ABSTAIN_MARKER}`, "stop")).toEqual({
      ok: false,
      reason: "invalid_output",
    });
    expect(interpretCompletion("   ", "stop")).toEqual({ ok: false, reason: "invalid_output" });
  });
});
