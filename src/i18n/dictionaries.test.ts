import { describe, expect, it } from "vitest";
import { config } from "@/server/config";
import { AI_PROCESSOR_NAME, findContentViolations } from "@/server/content-rules";
import { NOTEBOOK_TOPICS } from "@/server/notebook";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";

/** Fictional demo contact number (555-01xx), allowed in the footer only (README tradeoffs). */
const DEMO_PHONE_KEY = "footer.contactPhone";

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
      findContentViolations(s)
        // The one exception: the footer's demo contact line (fictional 555-01xx, checked below).
        .filter((v) => !(path === DEMO_PHONE_KEY && v.rule === "phone_number"))
        .map((v) => `${path}: ${v.rule} "${v.match}"`),
    );
    expect(violations).toEqual([]);
  });

  it("the only other phone number is the footer's fictional 555-01xx demo contact", () => {
    expect(dict.footer.contactPhone).toMatch(/^555-01\d{2}$/);
    const with555 = strings(dict)
      .filter(([, s]) => /555/.test(s))
      .map(([path]) => path);
    expect(with555).toEqual([DEMO_PHONE_KEY]);
  });

  it("fallback and abstained copy point only to real roles, not the placeholder family team", () => {
    for (const body of [dict.safety.fallback.body, dict.safety.abstained.body]) {
      expect(body).not.toMatch(/family team|equipo de familias/i);
    }
  });

  it("names the AI data processor only in the privacy disclosures (ADR 0005)", () => {
    const naming = strings(dict)
      .filter(([, s]) => AI_PROCESSOR_NAME.test(s))
      .map(([path]) => path);
    expect(naming).toEqual(["help.processingNotice", "notebook.processingNotice"]);
  });

  it("has a label for every notebook topic and nothing else (labels never come from the model)", () => {
    expect(Object.keys(dict.notebook.topics).sort()).toEqual([...NOTEBOOK_TOPICS].sort());
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
