import { describe, expect, it } from "vitest";
import { config } from "@/server/config";
import { AI_PROCESSOR_NAME, findContentViolations } from "@/server/content-rules";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";

/** Every string in a dictionary, with its dotted path. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

describe.each([
  ["en", en],
  ["es", es],
])("dictionary %s: fixed safety copy", (_lang, dict) => {
  it("emergency and self-harm steps start with 911", () => {
    expect(dict.safety.emergency.steps[0]).toContain("911");
    expect(dict.safety.selfHarm.steps[0]).toContain("911");
  });

  it("self-harm and crisis copy include 988 and the outside-US line", () => {
    for (const steps of [dict.safety.selfHarm.steps, dict.safety.crisis.steps]) {
      expect(steps.some((s) => s.includes("988"))).toBe(true);
      expect(steps).toContain(dict.safety.outsideUs);
    }
    expect(dict.safety.crisisLine).toContain("988");
  });

  it("988 appears only in safety copy and the static crisis banner", () => {
    const with988 = strings(dict)
      .filter(([, s]) => /\b988\b/.test(s))
      .map(([path]) => path);
    for (const path of with988) {
      expect(path.startsWith("safety.") || path === "emergency.crisisBanner").toBe(true);
    }
  });

  it("passes the content rules (no other phone numbers, dosages or banned words)", () => {
    const violations = strings(dict).flatMap(([path, s]) =>
      findContentViolations(s).map((v) => `${path}: ${v.rule} "${v.match}"`),
    );
    expect(violations).toEqual([]);
  });

  it("names the AI data processor only in the privacy disclosure (ADR 0005)", () => {
    const naming = strings(dict)
      .filter(([, s]) => AI_PROCESSOR_NAME.test(s))
      .map(([path]) => path);
    expect(naming).toEqual(["help.processingNotice"]);
  });

  it("the gap disclosure states the configured retention period", () => {
    expect(dict.gaps.disclosure).toContain(String(config.gaps.retentionDays));
  });
});

describe("dictionary parity", () => {
  it("ES has the same keys and the same number of steps as EN", () => {
    const shape = (d: unknown) => strings(d).map(([path]) => path);
    expect(shape(es)).toEqual(shape(en));
  });
});
