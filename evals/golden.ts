import { z } from "zod";
import { TERMINAL_EVENT_TYPES } from "../src/server/pipeline";
import { ROUTE_CATEGORIES } from "../src/server/router";
import { LANGUAGES } from "../src/server/types";

/** Schema for one line of evals/golden.jsonl. Every `expect` field is optional: only what is set is checked. */
export const GoldenCaseSchema = z
  .object({
    id: z.string().regex(/^[a-z-]+-(en|es)-\d{3}$/),
    input: z.string().min(1),
    /** Page locale the question is asked from. */
    locale: z.enum(LANGUAGES),
    expect: z
      .object({
        /** The terminal event the request must end in. A list = any of these is acceptable
         * (only for honestly borderline cases, each with a `note`). */
        outcome: z
          .union([z.enum(TERMINAL_EVENT_TYPES), z.array(z.enum(TERMINAL_EVENT_TYPES)).min(2)])
          .optional(),
        /** For `emergency` outcomes: which kind of fixed copy. */
        kind: z.enum(["medical_emergency", "self_harm"]).optional(),
        /** Router category after precedence (not set when safety must short-circuit). */
        category: z.enum(ROUTE_CATEGORIES).optional(),
        /** For emergencies: which layer must catch it. "safety" = no model call at all. */
        detectedBy: z.enum(["safety", "router"]).optional(),
        language: z.enum(LANGUAGES).optional(),
        /** KB article ids; the answer must cite at least one of them. */
        articles: z
          .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
          .min(1)
          .optional(),
        mustCite: z.boolean().optional(),
        noDosage: z.boolean().optional(),
        mentionsCareTeam: z.boolean().optional(),
        /** Run the LLM-as-judge rubric (groundedness, boundary, tone, usefulness, Spanish). */
        judge: z.boolean().optional(),
      })
      .strict(),
    tags: z.array(z.string()).min(1),
    /**
     * The deterministic safety check is known to miss this phrasing (ADR 0003, Known
     * limitations): a later layer (the router) must catch it. Needs a `note`.
     */
    knownLimitation: z.literal(true).optional(),
    /** Why this case exists, for humans reading the eval report. */
    note: z.string().optional(),
  })
  .strict();
export type GoldenCase = z.infer<typeof GoldenCaseSchema>;
