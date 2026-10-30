import { z } from "zod";
import type { StepResult } from "../types";
import { LANGUAGES, NotImplementedError } from "../types";

/**
 * Router: one small, cheap structured-output call (generateText + Output.object)
 * that decides which path a question takes. It never answers the question itself.
 *
 *   practical        → answer/ grounded in the KB
 *   medical          → no advice; point to the care team and help prepare questions
 *   emotional_crisis → fixed calm message + human/crisis contacts (no generation)
 *   off_topic        → short fixed redirect
 */

export const ROUTE_CATEGORIES = ["practical", "medical", "emotional_crisis", "off_topic"] as const;
export type RouteCategory = (typeof ROUTE_CATEGORIES)[number];

export const RouteSchema = z.object({
  language: z.enum(LANGUAGES),
  category: z.enum(ROUTE_CATEGORIES),
});
export type Route = z.infer<typeof RouteSchema>;

export type RouteInput = {
  question: string;
};

export async function routeQuestion(_input: RouteInput): Promise<StepResult<Route>> {
  // TODO(phase-1): generateText({ model, output: Output.object({ schema: RouteSchema }),
  //   maxOutputTokens: config.limits.maxRouterOutputTokens, maxRetries: config.retry.maxRetries,
  //   abortSignal: AbortSignal.timeout(config.timeouts.routerMs) }) and map errors to FailureReason.
  throw new NotImplementedError("router.routeQuestion");
}
