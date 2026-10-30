import { describe, expect, it } from "vitest";
import { ArticleFrontmatterSchema, countWords, parseArticleFile } from "./index";

const valid = {
  id: "first-days-at-the-hospital",
  lang: "en",
  title: "Your first days at the hospital: what to bring",
  category: "hospital-logistics",
  risk: "standard",
  reviewedAt: "2026-10-30",
};

describe("knowledge.ArticleFrontmatterSchema (contract)", () => {
  it("accepts valid frontmatter", () => {
    expect(ArticleFrontmatterSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects ids that are not kebab-case and non-ISO dates", () => {
    expect(ArticleFrontmatterSchema.safeParse({ ...valid, id: "Parking Meals" }).success).toBe(
      false,
    );
    expect(ArticleFrontmatterSchema.safeParse({ ...valid, reviewedAt: "30/10/2026" }).success).toBe(
      false,
    );
  });

  it("requires a risk level and rejects unknown keys", () => {
    const { risk: _risk, ...withoutRisk } = valid;
    expect(ArticleFrontmatterSchema.safeParse(withoutRisk).success).toBe(false);
    expect(ArticleFrontmatterSchema.safeParse({ ...valid, risk: "medium" }).success).toBe(false);
    expect(ArticleFrontmatterSchema.safeParse({ ...valid, author: "x" }).success).toBe(false);
  });

  it.todo("assigns stable handles sorted by id");
});

describe("knowledge.parseArticleFile", () => {
  const file = [
    "---",
    "id: first-days-at-the-hospital",
    "lang: en",
    'title: "Your first days at the hospital: what to bring"',
    "category: hospital-logistics   ",
    "risk: standard",
    "reviewedAt: 2026-10-30",
    "---",
    "",
    "## Bring",
    "A charger.",
    "",
  ].join("\n");

  it("parses flat frontmatter, strips quotes and trims the body", () => {
    expect(parseArticleFile(file)).toEqual({ ...valid, body: "## Bring\nA charger." });
  });

  it("accepts CRLF line endings", () => {
    expect(parseArticleFile(file.replace(/\n/g, "\r\n")).id).toBe(valid.id);
  });

  it("throws on missing frontmatter, duplicate keys or invalid fields", () => {
    expect(() => parseArticleFile("no frontmatter")).toThrow();
    expect(() =>
      parseArticleFile(file.replace("risk: standard", "risk: standard\nrisk: high")),
    ).toThrow(/duplicate/);
    expect(() => parseArticleFile(file.replace("lang: en", "lang: fr"))).toThrow();
  });
});

describe("knowledge.countWords", () => {
  it("counts words, not markdown symbols", () => {
    expect(countWords("## Two words\n\n- one\n- dos, tres.")).toBe(5);
  });
});
