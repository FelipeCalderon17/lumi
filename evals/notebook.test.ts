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

  it("covers verbatim, classification, language, questions, injection and safety", () => {
    const tags = new Set(cases.flatMap((c) => c.tags));
    for (const tag of [
      "verbatim",
      "classification",
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

  it("expected topics and question notes point at real notes; injection cases score the other notes", () => {
    for (const c of cases) {
      const indexes = [
        ...Object.keys(c.expect.expectedTopics ?? {}).map(Number),
        ...(c.expect.questionNotes ?? []),
      ];
      for (const i of indexes) expect([c.id, i < c.notes.length]).toEqual([c.id, true]);
      if (c.tags.includes("injection")) {
        expect([c.id, Object.keys(c.expect.expectedTopics ?? {}).length > 0]).toEqual([c.id, true]);
      }
    }
  });

  it("safety notices match the deterministic check note by note (free, no model)", () => {
    for (const c of cases) {
      const flagged = c.notes.flatMap((note, i) =>
        checkEmergency(note.text).triggered ? [i] : [],
      );
      expect([c.id, flagged]).toEqual([c.id, c.expect.safetyNoticeNotes ?? []]);
    }
  });
});
