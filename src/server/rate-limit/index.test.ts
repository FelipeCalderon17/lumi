import { describe, expect, it } from "vitest";
import { NotImplementedError } from "../types";
import { createRateLimiter } from "./index";

describe("rateLimit.createRateLimiter (contract)", () => {
  it("is a stub until Phase 1", () => {
    expect(() => createRateLimiter({ windowMs: 1000, max: 1 })).toThrow(NotImplementedError);
  });

  it.todo("allows up to `max` requests per window, then returns retryAfterMs");
});
