import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { config } from "../src/server/config";
import { checkEmergency } from "../src/server/safety";
import { type NotebookCase, NotebookCaseSchema } from "./notebook";

const cases: NotebookCase[] = readFileSync(new URL("./notebook.jsonl", import.meta.url), "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => NotebookCaseSchema.parse(JSON.parse(line)));

describe("evals/notebook.jsonl", () => {
  it("every line is a valid case with a unique id", () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });

  it("covers faithfulness, no advice, language, questions, injection and safety", () => {
    const tags = new Set(cases.flatMap((c) => c.tags));
    for (const tag of [
      "faithfulness",
      "no-advice",
      "language",
      "questions",
      "injection",
      "safety",
    ]) {
      expect(tags).toContain(tag);
    }
  });

  it("each id starts with one of its tags", () => {
    for (const c of cases) {
      const [, prefix] = /^notebook-([a-z-]+?)-(?:en|es)-\d{3}$/.exec(c.id) ?? [];
      expect(c.tags.some((tag) => prefix?.startsWith(tag))).toBe(true);
    }
  });

  it("every case fits the endpoint's limits", () => {
    for (const c of cases) {
      expect(c.notes.length).toBeLessThanOrEqual(config.limits.notebook.maxNotes);
      for (const note of c.notes) {
        expect(note.text.length).toBeLessThanOrEqual(config.limits.notebook.maxNoteChars);
      }
    }
  });

  it("safety cases trigger the deterministic check; the others don't (free, no model)", () => {
    for (const c of cases) {
      const triggered = c.notes.some((note) => checkEmergency(note.text).triggered);
      expect([c.id, triggered]).toEqual([c.id, c.expect.outcome === "emergency"]);
    }
  });
});
