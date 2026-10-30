import { describe, expect, it } from "vitest";
import { RouteSchema } from "./index";

describe("router.RouteSchema (contract)", () => {
  it("accepts a valid route", () => {
    expect(RouteSchema.parse({ language: "es", category: "practical" })).toEqual({
      language: "es",
      category: "practical",
    });
  });

  it("rejects unknown categories and languages", () => {
    expect(RouteSchema.safeParse({ language: "en", category: "billing" }).success).toBe(false);
    expect(RouteSchema.safeParse({ language: "fr", category: "practical" }).success).toBe(false);
  });

  it.todo("maps a timeout to { ok: false, reason: 'timeout' }");
  it.todo("maps schema-invalid model output to { ok: false, reason: 'invalid_output' }");
});
