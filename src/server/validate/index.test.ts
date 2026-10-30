import { describe, expect, it } from "vitest";
import { NotImplementedError } from "../types";
import { validateCitations } from "./index";

describe("validate.validateCitations (contract)", () => {
  it("is a stub until Phase 2", () => {
    expect(() => validateCitations("See [1].", new Set([1]))).toThrow(NotImplementedError);
  });

  it.todo("returns valid with the cited handles when all exist");
  it.todo("returns invalid/unknown_handles for [99] when the KB has 20 articles");
  it.todo("returns invalid/no_citations for an answer without markers");
  it.todo("returns abstained when the answer starts with ABSTAIN_MARKER");
});
