import { describe, expect, it } from "vitest";
import { fingerprint } from "./fingerprint";
import { buildKnowledgeBase } from "./knowledge";
import { testArticles, testKb } from "./test-helpers";

describe("fingerprint", () => {
  it("is stable for the same KB and changes when an article changes", () => {
    const kbs = { en: testKb("en"), es: testKb("es") };
    const a = fingerprint(kbs);
    expect(fingerprint({ en: testKb("en"), es: testKb("es") })).toEqual(a);
    expect(a.prompts).toMatch(/^[0-9a-f]{64}$/);

    const edited = testArticles("es").map((x, i) => (i === 0 ? { ...x, body: "Changed." } : x));
    const b = fingerprint({ en: kbs.en, es: buildKnowledgeBase("es", edited) });
    expect(b.kb.en).toBe(a.kb.en);
    expect(b.kb.es).not.toBe(a.kb.es);
    expect(b.prompts).not.toBe(a.prompts);
  });
});
