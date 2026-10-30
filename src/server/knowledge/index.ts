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

export async function loadKnowledgeBase(_language: Language): Promise<KnowledgeBase> {
  // TODO(phase-2): read content/kb/<lang>/*.md, parse + validate frontmatter, assign handles.
  throw new NotImplementedError("knowledge.loadKnowledgeBase");
}
