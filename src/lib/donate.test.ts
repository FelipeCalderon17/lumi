import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { es } from "@/i18n/dictionaries/es";
import { DONATION_PRESETS, impactTierFor, parseCustomAmount } from "./donate";

describe("impactTierFor", () => {
  it("maps each preset to itself", () => {
    for (const preset of DONATION_PRESETS) expect(impactTierFor(preset)).toBe(preset);
  });

  it("maps a custom amount to the largest preset at or below it", () => {
    expect(impactTierFor(30)).toBe(25);
    expect(impactTierFor(99)).toBe(50);
    expect(impactTierFor(249)).toBe(100);
    expect(impactTierFor(10_000)).toBe(250);
  });

  it("small amounts get the general line; invalid amounts get nothing", () => {
    expect(impactTierFor(5)).toBe("small");
    expect(impactTierFor(0)).toBeNull();
    expect(impactTierFor(-25)).toBeNull();
    expect(impactTierFor(Number.NaN)).toBeNull();
  });

  it("every tier has fixed copy in both languages", () => {
    for (const dict of [en, es]) {
      for (const tier of [...DONATION_PRESETS, "small"] as const) {
        expect(dict.donate.impact[`t${tier}`].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("parseCustomAmount", () => {
  it("accepts whole dollars with an optional $ and .00", () => {
    expect(parseCustomAmount("40")).toBe(40);
    expect(parseCustomAmount(" $75 ")).toBe(75);
    expect(parseCustomAmount("120.00")).toBe(120);
  });

  it("rejects cents, words, zero and huge amounts", () => {
    for (const input of ["", "abc", "0", "12.50", "-5", "1e3", "1000001", "1,000"]) {
      expect(parseCustomAmount(input)).toBeNull();
    }
  });
});
