import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { es } from "@/i18n/dictionaries/es";
import { ABSTAIN_MARKER } from "../answer";
import { config } from "../config";
import { AI_PROCESSOR_NAME, findContentViolations } from "../content-rules";
import { LANGUAGES } from "../types";
import { type Article, countWords, MEDICAL_REDIRECT_ARTICLE_ID, parseArticleFile } from "./index";

/**
 * KB content gate (runs in `pnpm test`, so it gates CI). Rules: docs/CONTENT-GUIDELINES.md
 * § Automated checks. These catch slips; Felipe still reviews every article, and every
 * `risk: high` article personally.
 */

const MIN_WORDS = 250;
const MAX_WORDS = 450;
/** Articles that must stay high-risk whatever else changes. */
const MUST_BE_HIGH_RISK = [
  MEDICAL_REDIRECT_ARTICLE_ID,
  "when-to-call-your-care-team",
  "taking-care-of-yourself",
];
const CRISIS_LINE = { en: en.safety.crisisLine, es: es.safety.crisisLine };

const kbDir = new URL("../../../content/kb/", import.meta.url);

function load(lang: (typeof LANGUAGES)[number]): { file: string; article: Article }[] {
  return readdirSync(new URL(`${lang}/`, kbDir))
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({
      file,
      article: parseArticleFile(readFileSync(new URL(`${lang}/${file}`, kbDir), "utf8")),
    }));
}

const kb = { en: load("en"), es: load("es") };
const all = LANGUAGES.flatMap((lang) => kb[lang].map((entry) => ({ lang, ...entry })));

describe("KB content", () => {
  it("has articles in both languages", () => {
    expect(kb.en.length).toBeGreaterThan(0);
    expect(kb.es.length).toBe(kb.en.length);
  });

  it.each(all.map((e) => [`${e.lang}/${e.file}`, e] as const))(
    "%s: frontmatter matches its folder and file name",
    (_name, { lang, file, article }) => {
      expect(article.lang).toBe(lang);
      expect(file).toBe(`${article.id}.md`);
    },
  );

  it("ids are unique within each language", () => {
    for (const lang of LANGUAGES) {
      const ids = kb[lang].map((e) => e.article.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("every EN article has an ES pair and vice versa, with the same category and risk", () => {
    const pairs = (lang: "en" | "es") =>
      kb[lang].map((e) => `${e.article.id}|${e.article.category}|${e.article.risk}`).sort();
    expect(pairs("es")).toEqual(pairs("en"));
  });

  it.each(all.map((e) => [`${e.lang}/${e.file}`, e] as const))(
    `%s: body is ${MIN_WORDS}–${MAX_WORDS} words`,
    (_name, { article }) => {
      const words = countWords(article.body);
      expect(words).toBeGreaterThanOrEqual(MIN_WORDS);
      expect(words).toBeLessThanOrEqual(MAX_WORDS);
    },
  );

  it.each(all.map((e) => [`${e.lang}/${e.file}`, e] as const))(
    "%s: no dosages, banned words or phone numbers (988 only in the approved line)",
    (_name, { lang, article }) => {
      const text = `${article.title}\n${article.body}`;
      expect(findContentViolations(text)).toEqual([]);
      const withoutCrisisLine = text.split(CRISIS_LINE[lang]).join("");
      expect(withoutCrisisLine).not.toMatch(/\b988\b/);
    },
  );

  it.each(all.map((e) => [`${e.lang}/${e.file}`, e] as const))(
    "%s: contains nothing that looks like a citation handle or the abstain marker",
    (_name, { article }) => {
      expect(article.body).not.toMatch(/\[\d+(?:\s*,\s*\d+)*\]/);
      expect(article.body).not.toContain(ABSTAIN_MARKER);
    },
  );

  it("names the AI data processor only in the how-lumi-can-help disclosure (ADR 0005)", () => {
    const naming = all
      .filter((e) => AI_PROCESSOR_NAME.test(`${e.article.title}\n${e.article.body}`))
      .map((e) => `${e.lang}/${e.article.id}`);
    expect(naming).toEqual(["en/how-lumi-can-help", "es/how-lumi-can-help"]);
  });

  it("the medical template's article exists in both languages", () => {
    for (const lang of LANGUAGES) {
      expect(kb[lang].map((e) => e.article.id)).toContain(MEDICAL_REDIRECT_ARTICLE_ID);
    }
  });

  it("articles about symptoms, the clinical boundary and crisis are marked high-risk", () => {
    for (const { article } of all) {
      if (MUST_BE_HIGH_RISK.includes(article.id))
        expect([article.id, article.risk]).toEqual([article.id, "high"]);
    }
  });

  it("the gap retention stated in how-lumi-can-help matches config.gaps.retentionDays", () => {
    // The article repeats the processing and retention disclosure (ADR 0005); if config changes,
    // the article must change with it.
    const stated = {
      en: /older than (\d+) days are deleted/,
      es: /de más de (\d+) días se borran/,
    } as const;
    for (const lang of LANGUAGES) {
      const article = kb[lang].find((e) => e.article.id === "how-lumi-can-help")?.article;
      const days = article ? stated[lang].exec(article.body)?.[1] : undefined;
      expect([lang, Number(days)]).toEqual([lang, config.gaps.retentionDays]);
    }
  });
});
