import { describe, expect, it } from "vitest";
import { NotImplementedError } from "../types";
import { estimateCostUsd } from "./index";

describe("ledger.estimateCostUsd (contract)", () => {
  it("is a stub until Phase 3", () => {
    expect(() =>
      estimateCostUsd({
        model: "gpt-6-luna",
        inputTokens: 1,
        cachedInputTokens: 0,
        outputTokens: 1,
      }),
    ).toThrow(NotImplementedError);
  });

  it.todo("bills cached input tokens at the cached rate");
  it.todo("returns 0 for a request that never reached a model (emergency path)");
});
