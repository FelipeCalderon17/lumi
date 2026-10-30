import { describe, expect, it } from "vitest";
import { incompleteFinish, structuredOutputFailure } from "./models";

describe("models.incompleteFinish (completion check)", () => {
  it("only 'stop' is complete; 'length' is truncated, anything else interrupted", () => {
    expect(incompleteFinish("stop")).toBeNull();
    expect(incompleteFinish("length")).toBe("truncated");
    for (const reason of ["content-filter", "error", "other", "tool-calls", "none"] as const) {
      expect(incompleteFinish(reason)).toBe("interrupted");
    }
    expect(incompleteFinish(undefined)).toBe("interrupted");
  });
});

describe("models.structuredOutputFailure", () => {
  it("a schema-invalid object is invalid_output unless the finish explains it", () => {
    expect(structuredOutputFailure("stop")).toBe("invalid_output");
    expect(structuredOutputFailure(undefined)).toBe("invalid_output");
    expect(structuredOutputFailure("length")).toBe("truncated");
    expect(structuredOutputFailure("content-filter")).toBe("interrupted");
  });
});
