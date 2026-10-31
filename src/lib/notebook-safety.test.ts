import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { es } from "@/i18n/dictionaries/es";
import type { NotebookSafetyNotice } from "@/server/notebook";
import { localSafetyNotices, noticeCopy, noticeKinds, noticeLines } from "./notebook-safety";
import { notebookPlainText } from "./notebook-text";

const notice = (kind: NotebookSafetyNotice["kind"], noteIndex = 0): NotebookSafetyNotice => ({
  kind,
  detectedBy: "safety",
  language: "en",
  noteIndex,
});

describe("localSafetyNotices (the shared deterministic check, on the device)", () => {
  it("flags each matching note by index, EN and ES, and nothing else", () => {
    expect(
      localSafetyNotices([
        { text: "Ate half his dinner." },
        { text: "Last night he stopped breathing for a few seconds" },
        { text: "Hoy no quiere comer." },
        { text: "Quiero morir, ya no puedo más" },
      ]),
    ).toEqual([
      { kind: "medical_emergency", detectedBy: "safety", language: "en", noteIndex: 1 },
      { kind: "self_harm", detectedBy: "safety", language: "es", noteIndex: 3 },
    ]);
  });

  it("returns nothing for ordinary notes", () => {
    expect(localSafetyNotices([{ text: "Ask about school" }])).toEqual([]);
  });
});

describe("noticeKinds", () => {
  it("merges lists, one per kind, medical emergency first", () => {
    expect(
      noticeKinds([notice("self_harm", 2)], [notice("medical_emergency"), notice("self_harm")]),
    ).toEqual(["medical_emergency", "self_harm"]);
    expect(noticeKinds([], [])).toEqual([]);
  });
});

describe.each([
  ["en", en],
  ["es", es],
] as const)("notice copy and export (%s)", (_lang, t) => {
  it("medical emergency: the fixed title, body and every emergency step (911)", () => {
    const lines = noticeLines(["medical_emergency"], t);
    expect(lines).toEqual([
      t.notebook.safetyTitle,
      t.notebook.safetyBody,
      ...t.safety.emergency.steps.map((s) => `- ${s}`),
    ]);
    expect(lines.join("\n")).toContain("911");
    expect(lines.join("\n")).not.toContain("988");
  });

  it("self-harm: the fixed title, body and every self-harm step, 911 and 988", () => {
    const lines = noticeLines(["self_harm"], t);
    expect(lines).toEqual([
      t.notebook.selfHarmTitle,
      t.notebook.safetyBody,
      ...t.safety.selfHarm.steps.map((s) => `- ${s}`),
    ]);
    expect(lines.join("\n")).toContain("911");
    expect(lines.join("\n")).toContain("988");
  });

  it("both kinds: both blocks, separated by a blank line", () => {
    const lines = noticeLines(["medical_emergency", "self_harm"], t);
    const blank = lines.indexOf("");
    expect(lines.slice(0, blank)).toEqual(noticeLines(["medical_emergency"], t));
    expect(lines.slice(blank + 1)).toEqual(noticeLines(["self_harm"], t));
  });

  it("the copied page puts the full notice BEFORE the notes", () => {
    const text = notebookPlainText({
      title: t.notebook.resultTitle,
      subtitle: "-",
      safety: noticeLines(["self_harm"], t),
      groups: [{ heading: t.notebook.byDateTitle, notes: [{ date: "d", text: "my note" }] }],
    });
    const lastStep = t.safety.selfHarm.steps.at(-1) ?? "";
    expect(text.indexOf(lastStep)).toBeGreaterThan(0);
    expect(text.indexOf(lastStep)).toBeLessThan(text.indexOf("my note"));
  });

  it("the screen and the export use the same copy", () => {
    expect(noticeCopy("self_harm", t).steps).toBe(t.safety.selfHarm.steps);
    expect(noticeCopy("medical_emergency", t).steps).toBe(t.safety.emergency.steps);
  });
});
