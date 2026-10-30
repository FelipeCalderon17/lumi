import { describe, expect, it } from "vitest";
import { isLocale, negotiateLocale } from "./config";

describe("i18n config", () => {
  it("recognises supported locales only", () => {
    expect(isLocale("es")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("negotiates Spanish variants to es and everything else to en", () => {
    expect(negotiateLocale("es-MX,es;q=0.9,en;q=0.8")).toBe("es");
    expect(negotiateLocale("en-US,en;q=0.9")).toBe("en");
    expect(negotiateLocale("fr-FR")).toBe("en");
    expect(negotiateLocale(null)).toBe("en");
  });
});
