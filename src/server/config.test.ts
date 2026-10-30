import { describe, expect, it } from "vitest";
import { config } from "./config";

describe("config", () => {
  it("has exactly one retry layer with at most one retry", () => {
    expect(config.retry.maxRetries).toBeLessThanOrEqual(1);
  });

  it("has pricing for every configured model", () => {
    for (const model of Object.values(config.models)) {
      expect(config.pricingUsdPerMillionTokens).toHaveProperty(model);
    }
  });
});
