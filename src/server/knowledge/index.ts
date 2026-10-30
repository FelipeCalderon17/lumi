import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Language } from "../types";
import { LANGUAGES } from "../types";

/**
 * Knowledge base: curated markdown articles in content/kb/{en,es}/ (ADR 0002, 0004).
 *
 * Each language is loaded separately. Articles are sorted by `id` and given integer
 * handles [1], [2], … so the model cites short, checkable tokens instead of titles or URLs.
 * Sorting by id keeps handles (and therefore the cached prompt prefix) stable between deploys.
 */

export const KB_TOPICS = [
  "hospital-logistics",
  "money-and-work",
  "family-and-school",
  "talking-with-the-care-team",
  "caring-for-yourself",
  "about-lumi",
] as const;
export type KbTopic = (typeof KB_TOPICS)[number];

/** `high` = touches symptoms, clinical boundaries or emotional crisis; a human reviews every edit. */
export const RISK_LEVELS = ["standard", "high"] as const;

/** The medical template always links this article (ADR 0010). Tests check it exists in EN and ES. */
export const MEDICAL_REDIRECT_ARTICLE_ID = "questions-for-your-care-team";

export const ArticleFrontmatterSchema = z
  .object({
    /** Same id in EN and ES: that is how parity is checked. */
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    lang: z.enum(LANGUAGES),
    title: z.string().min(3).max(120),
    category: z.enum(KB_TOPICS),
    risk: z.enum(RISK_LEVELS),
    /** ISO date of the last human review. */
    reviewedAt: z.iso.date(),
  })
  .strict();
export type ArticleFrontmatter = z.infer<typeof ArticleFrontmatterSchema>;

export type Article = ArticleFrontmatter & { body: string };

export type HandledArticle = Article & { handle: number };

export type KnowledgeBase = {
  language: Language;
  /** Sorted by id; handle = position + 1. */
  articles: readonly HandledArticle[];
  byHandle: ReadonlyMap<number, HandledArticle>;
  byId: ReadonlyMap<string, HandledArticle>;
  /** SHA-256 of the articles as loaded (frontmatter + body), for freezing eval runs. */
  hash: string;
};

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

/**
 * Parses one article file. Frontmatter is deliberately flat `key: value` lines (optionally
 * quoted, `#` comments allowed), so no YAML dependency is needed. Throws on invalid input:
 * a broken article must fail the build, not reach a parent.
 */
export function parseArticleFile(text: string): Article {
  const match = FRONTMATTER.exec(text.replace(/\r\n/g, "\n"));
  if (!match) throw new Error("missing frontmatter block");
  const [, head = "", body = ""] = match;
  const fields: Record<string, string> = {};
  for (const line of head.split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const kv = /^([a-zA-Z]+):\s*(.*?)\s*$/.exec(line);
    if (!kv) throw new Error(`invalid frontmatter line: ${line}`);
    const [, key = "", raw = ""] = kv;
    if (key in fields) throw new Error(`duplicate frontmatter key: ${key}`);
    fields[key] = raw.replace(/^"(.*)"$/, "$1");
  }
  return { ...ArticleFrontmatterSchema.parse(fields), body: body.trim() };
}

/** Words as a reader would count them: tokens with at least one letter or digit. */
export function countWords(markdown: string): number {
  return markdown.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/**
 * Sorts by id and assigns handles [1]..[n]. Same articles → same handles, same hash, and
 * therefore a byte-identical prompt prefix (cache-friendly, ADR 0002).
 */
export function buildKnowledgeBase(
  language: Language,
  articles: readonly Article[],
): KnowledgeBase {
  const sorted = [...articles].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const handled = sorted.map((article, i) => {
    if (article.lang !== language) {
      throw new Error(`article ${article.id} is "${article.lang}", expected "${language}"`);
    }
    return { ...article, handle: i + 1 };
  });
  const ids = new Set(handled.map((a) => a.id));
  if (ids.size !== handled.length) throw new Error(`duplicate article id in ${language} KB`);
  const hash = createHash("sha256");
  for (const a of handled) {
    hash.update(JSON.stringify([a.id, a.lang, a.title, a.category, a.risk, a.reviewedAt, a.body]));
  }
  return {
    language,
    articles: handled,
    byHandle: new Map(handled.map((a) => [a.handle, a])),
    byId: new Map(handled.map((a) => [a.id, a])),
    hash: hash.digest("hex"),
  };
}

/** content/kb, resolved from the working directory (the app root under `next start`). */
export function defaultKbDir(): string {
  return path.join(process.cwd(), "content", "kb");
}

/**
 * Reads content/kb/<lang>/*.md, validates every file (a broken article throws: it must fail
 * the boot or the build, not reach a parent) and assigns handles.
 */
export async function loadKnowledgeBase(
  language: Language,
  kbDir: string = defaultKbDir(),
): Promise<KnowledgeBase> {
  const dir = path.join(kbDir, language);
  const files = (await readdir(dir)).filter((file) => file.endsWith(".md")).sort();
  const articles = await Promise.all(
    files.map(async (file) => {
      const article = parseArticleFile(await readFile(path.join(dir, file), "utf8"));
      if (`${article.id}.md` !== file) throw new Error(`${language}/${file}: id is ${article.id}`);
      return article;
    }),
  );
  if (articles.length === 0) throw new Error(`no articles in ${dir}`);
  return buildKnowledgeBase(language, articles);
}

const cache = new Map<Language, Promise<KnowledgeBase>>();

/**
 * The KB for a language, loaded once per process and reused by every request. Preloaded at
 * server start (src/instrumentation.ts), so an invalid article fails the boot.
 * A failed load is not cached, so a transient read error can recover.
 */
export function getKnowledgeBase(language: Language): Promise<KnowledgeBase> {
  let kb = cache.get(language);
  if (!kb) {
    kb = loadKnowledgeBase(language);
    kb.catch(() => cache.delete(language));
    cache.set(language, kb);
  }
  return kb;
}

export async function preloadKnowledgeBases(): Promise<void> {
  await Promise.all(LANGUAGES.map(getKnowledgeBase));
}
