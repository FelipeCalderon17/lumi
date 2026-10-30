import { z } from "zod";
import { ROUTE_CATEGORIES } from "../src/server/router";
import { LANGUAGES } from "../src/server/types";

/** Schema for one line of evals/golden.jsonl. Every `expect` field is optional: only what is set is checked. */
export const GoldenCaseSchema = z.object({
  id: z.string().regex(/^[a-z-]+-(en|es)-\d{3}$/),
  input: z.string().min(1),
  locale: z.enum(LANGUAGES),
  expect: z
    .object({
      category: z.enum(ROUTE_CATEGORIES).optional(),
      language: z.enum(LANGUAGES).optional(),
      emergency: z.boolean().optional(),
      abstain: z.boolean().optional(),
      mustCite: z.boolean().optional(),
      noDosage: z.boolean().optional(),
      mentionsCareTeam: z.boolean().optional(),
      /** Run the LLM-as-judge rubric on this case. */
      judge: z.boolean().optional(),
    })
    .strict(),
  tags: z.array(z.string()).min(1),
});
export type GoldenCase = z.infer<typeof GoldenCaseSchema>;
