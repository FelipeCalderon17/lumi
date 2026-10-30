import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type GoldenCase, GoldenCaseSchema } from "./golden";

/** Every category in docs/EVALS.md § Golden set must have at least one case. */
const REQUIRED_TAGS = [
  "practical",
  "medical-boundary",
  "emergency",
  "self-harm",
  "crisis",
  "mixed-intent",
  "not-in-kb",
  "off-topic",
  "injection",
  "unsupported-claim",
  "language-mismatch",
  "false-positive",
];

const lines = readFileSync(new URL("./golden.jsonl", import.meta.url), "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "");
const cases: GoldenCase[] = lines.map((line) => GoldenCaseSchema.parse(JSON.parse(line)));

function kbIds(lang: "en" | "es"): Set<string> {
  const dir = new URL(`../content/kb/${lang}/`, import.meta.url);
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, "")),
  );
}

describe("evals/golden.jsonl", () => {
  it("every line is a valid golden case with a unique id", () => {
    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every category in EVALS.md", () => {
    const tags = new Set(cases.flatMap((c) => c.tags));
    for (const tag of REQUIRED_TAGS) expect(tags).toContain(tag);
  });

  it("each id starts with one of its tags and ends with the question's language", () => {
    for (const c of cases) {
      const [, prefix, lang] = /^([a-z-]+)-(en|es)-\d{3}$/.exec(c.id) ?? [];
      expect(c.tags).toContain(prefix);
      if (c.expect.language) expect([c.id, lang]).toEqual([c.id, c.expect.language]);
    }
  });

  it("every expected article exists in the KB of the answer's language", () => {
    const ids = { en: kbIds("en"), es: kbIds("es") };
    for (const c of cases) {
      for (const article of c.expect.articles ?? []) {
        expect([c.id, ids[c.expect.language ?? c.locale].has(article)]).toEqual([c.id, true]);
      }
    }
  });

  it("practical cases cover every KB article", () => {
    const covered = new Set(
      cases.filter((c) => c.tags.includes("practical")).flatMap((c) => c.expect.articles ?? []),
    );
    expect([...kbIds("en")].filter((id) => !covered.has(id))).toEqual([]);
  });

  it("borderline cases (several acceptable outcomes) explain why", () => {
    for (const c of cases.filter((c) => Array.isArray(c.expect.outcome))) {
      expect([c.id, Boolean(c.note)]).toEqual([c.id, true]);
    }
  });

  it("is roughly balanced between EN and ES", () => {
    const es = cases.filter((c) => c.id.includes("-es-")).length;
    expect(Math.abs(es - (cases.length - es))).toBeLessThanOrEqual(4);
  });
});
