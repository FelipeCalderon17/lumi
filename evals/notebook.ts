import { z } from "zod";
import { NOTEBOOK_TOPICS } from "../src/server/notebook";
import { LANGUAGES } from "../src/server/types";

/**
 * Schema for one line of evals/notebook.jsonl: cases for POST /api/notebook/prepare, which
 * only CLASSIFIES notes into fixed topics (ADR 0015). Schema-checked for free in `pnpm test`;
 * the checks themselves run in `pnpm eval` (Phase 4).
 *
 * Checked on EVERY case, no flag needed: every input note is present exactly once, verbatim,
 * with its createdAt, and the response holds no other text. Code guarantees this by
 * construction; the eval re-checks it on real outputs.
 */
export const NotebookCaseSchema = z
  .object({
    id: z.string().regex(/^notebook-[a-z-]+-(en|es)-\d{3}$/),
    locale: z.enum(LANGUAGES),
    notes: z
      .array(
        z.object({ text: z.string().min(1), createdAt: z.iso.datetime({ offset: true }) }).strict(),
      )
      .min(1),
    expect: z
      .object({
        /** `result.kind` the endpoint must return. */
        outcome: z.enum(["organized", "fallback"]),
        /**
         * Note indexes that must come back as safety notices (fixed emergency steps shown
         * first, the page still prepared). Omitted = no notices expected.
         */
        safetyNoticeNotes: z.array(z.number().int().min(0)).min(1).optional(),
        /**
         * Clear cases only: note index → the topic group it must land in. Scored as
         * classification accuracy (EVALS.md). Ambiguous notes are left out.
         */
        expectedTopics: z.record(z.string().regex(/^\d+$/), z.enum(NOTEBOOK_TOPICS)).optional(),
        /** Notes that must land under "questions" (the parent's own question, verbatim). */
        questionNotes: z.array(z.number().int().min(0)).min(1).optional(),
      })
      .strict(),
    tags: z.array(z.string()).min(1),
    note: z.string().optional(),
  })
  .strict();
export type NotebookCase = z.infer<typeof NotebookCaseSchema>;
