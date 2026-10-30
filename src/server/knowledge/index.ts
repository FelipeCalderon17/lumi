import { z } from "zod";
import type { Language } from "../types";
import { LANGUAGES, NotImplementedError } from "../types";

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
  articles: readonly HandledArticle[];
  byHandle: ReadonlyMap<number, HandledArticle>;
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

export async function loadKnowledgeBase(_language: Language): Promise<KnowledgeBase> {
  // TODO(phase-2): read content/kb/<lang>/*.md, parse + validate frontmatter, assign handles.
  throw new NotImplementedError("knowledge.loadKnowledgeBase");
}
