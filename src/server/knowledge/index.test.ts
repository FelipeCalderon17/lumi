import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { testArticles } from "../test-helpers";
import {
  ArticleFrontmatterSchema,
  buildKnowledgeBase,
  countWords,
  loadKnowledgeBase,
  parseArticleFile,
} from "./index";

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
});

describe("knowledge.buildKnowledgeBase", () => {
  it("assigns stable handles sorted by id, whatever the input order", () => {
    const articles = testArticles("en", 3);
    const kb = buildKnowledgeBase("en", [...articles].reverse());
    expect(kb.articles.map((a) => [a.handle, a.id])).toEqual([
      [1, "article-01"],
      [2, "article-02"],
      [3, "article-03"],
    ]);
    expect(kb.byHandle.get(2)?.id).toBe("article-02");
    expect(kb.byId.get("article-03")?.handle).toBe(3);
    expect(kb.hash).toBe(buildKnowledgeBase("en", articles).hash);
  });

  it("changes the hash when any article changes", () => {
    const articles = testArticles("en", 3);
    const edited = articles.map((a, i) => (i === 1 ? { ...a, body: `${a.body} More.` } : a));
    expect(buildKnowledgeBase("en", edited).hash).not.toBe(buildKnowledgeBase("en", articles).hash);
  });

  it("rejects articles in the wrong language and duplicate ids", () => {
    expect(() => buildKnowledgeBase("es", testArticles("en", 1))).toThrow(/expected "es"/);
    const [one] = testArticles("en", 1);
    if (!one) throw new Error("fixture");
    expect(() => buildKnowledgeBase("en", [one, one])).toThrow(/duplicate/);
  });
});

describe("knowledge.loadKnowledgeBase", () => {
  const article = (id: string, lang = "en") =>
    `---\nid: ${id}\nlang: ${lang}\ntitle: Title of ${id}\ncategory: about-lumi\nrisk: standard\nreviewedAt: 2026-10-30\n---\nBody.\n`;

  function kbDir(files: Record<string, string>): string {
    const root = mkdtempSync(path.join(tmpdir(), "lumi-kb-"));
    mkdirSync(path.join(root, "en"));
    for (const [name, text] of Object.entries(files))
      writeFileSync(path.join(root, "en", name), text);
    return root;
  }

  it("loads, validates and handles the articles of one language", async () => {
    const kb = await loadKnowledgeBase(
      "en",
      kbDir({ "b-guide.md": article("b-guide"), "a-guide.md": article("a-guide"), "x.txt": "" }),
    );
    expect(kb.articles.map((a) => a.id)).toEqual(["a-guide", "b-guide"]);
  });

  it("fails loudly on a file whose name doesn't match its id, or invalid frontmatter", async () => {
    await expect(loadKnowledgeBase("en", kbDir({ "wrong.md": article("right") }))).rejects.toThrow(
      /id is right/,
    );
    await expect(loadKnowledgeBase("en", kbDir({ "a.md": article("a", "fr") }))).rejects.toThrow();
  });

  it("loads the real KB in both languages with the same ids and handles", async () => {
    const [en, es] = await Promise.all([loadKnowledgeBase("en"), loadKnowledgeBase("es")]);
    expect(en.articles.length).toBeGreaterThan(0);
    expect(es.articles.map((a) => [a.handle, a.id])).toEqual(
      en.articles.map((a) => [a.handle, a.id]),
    );
  });
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
