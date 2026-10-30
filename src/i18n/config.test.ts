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

  it("picks the highest-weight supported language, not just the first entry", () => {
    expect(negotiateLocale("fr-FR,es;q=0.9")).toBe("es");
    expect(negotiateLocale("fr-FR,en;q=0.5,es;q=0.8")).toBe("es");
    expect(negotiateLocale("en;q=0.4,es-MX;q=0.4")).toBe("en");
  });

  it("excludes languages marked q=0", () => {
    expect(negotiateLocale("es;q=0,en;q=1")).toBe("en");
    expect(negotiateLocale("es;q=0")).toBe("en");
  });

  it("ignores malformed weights", () => {
    expect(negotiateLocale("es;q=abc,en;q=0.1")).toBe("en");
  });
});
