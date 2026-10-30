import { describe, expect, it } from "vitest";
import { ABSTAIN_MARKER } from "./index";

describe("answer (contract)", () => {
  it("uses a marker that cannot be confused with a citation handle", () => {
    expect(ABSTAIN_MARKER).not.toMatch(/^\[\d+\]$/);
  });

  it.todo("buildSystemPrefix is byte-identical for the same KB (cache-friendly)");
  it.todo("the question is never part of the system prefix");
});
