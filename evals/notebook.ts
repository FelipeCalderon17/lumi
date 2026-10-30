import { z } from "zod";
import { LANGUAGES } from "../src/server/types";

/**
 * Schema for one line of evals/notebook.jsonl: cases for POST /api/notebook/prepare.
 * Schema-checked for free in `pnpm test`; the checks themselves run in `pnpm eval` (Phase 4).
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
        /** `result.type` the endpoint must return. */
        outcome: z.enum(["notebook", "notebook_fallback"]),
        /**
         * Note indexes that must come back as safety notices (fixed emergency steps shown
         * first, the page still prepared). Omitted = no notices expected.
         */
        safetyNoticeNotes: z.array(z.number().int().min(0)).min(1).optional(),
        /** Language of the structured page. */
        language: z.enum(LANGUAGES).optional(),
        /** Every number in the output must appear in a cited note (also enforced in code). */
        numbersFromNotesOnly: z.boolean().optional(),
        /** Case-insensitive phrases that must NOT appear anywhere in the output. */
        mustNotContain: z.array(z.string().min(1)).optional(),
        /** At least this many questions extracted. */
        minQuestions: z.number().int().min(0).optional(),
        /** Judge: every item is supported by its cited notes; no advice, interpretation or cause. */
        judge: z.boolean().optional(),
      })
      .strict(),
    tags: z.array(z.string()).min(1),
    note: z.string().optional(),
  })
  .strict();
export type NotebookCase = z.infer<typeof NotebookCaseSchema>;
