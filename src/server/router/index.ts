import { z } from "zod";
import type { RequestContext } from "../context";
import { KB_TOPICS } from "../knowledge";
import type { ModelStep } from "../types";
import { LANGUAGES, NotImplementedError } from "../types";

/**
 * Router: one small, cheap structured-output call (generateText + Output.object)
 * that decides which path a question takes. It never answers the question itself.
 *
 * The model lists EVERY intent it sees; code picks the path by fixed precedence, so a
 * mixed message ("what should I pack, also he's not breathing well") can't be routed to
 * the practical answer just because packing came first.
 *
 *   urgent           → fixed emergency copy (911), no generation
 *   emotional_crisis → fixed calm copy (988 + human contacts), no generation
 *   medical          → fixed medical template + link to the care-team article, no generation
 *   practical        → answer/ grounded in the KB
 *   off_topic        → short fixed redirect
 */

/** Ordered by precedence: the first one present wins. */
export const ROUTE_CATEGORIES = [
  "urgent",
  "emotional_crisis",
  "medical",
  "practical",
  "off_topic",
] as const;
export type RouteCategory = (typeof ROUTE_CATEGORIES)[number];

/** What the router model returns. */
export const RouterOutputSchema = z.object({
  language: z.enum(LANGUAGES),
  intents: z.array(z.enum(ROUTE_CATEGORIES)).min(1).max(ROUTE_CATEGORIES.length),
  /** Closest KB topic, stored with a consented gap so staff can triage it. */
  topic: z.enum([...KB_TOPICS, "other"]),
});
export type RouterOutput = z.infer<typeof RouterOutputSchema>;

export type Route = {
  language: RouterOutput["language"];
  category: RouteCategory;
  topic: RouterOutput["topic"];
};

/** Deterministic precedence: immediate danger → crisis → medical → practical → off_topic. */
export function resolveCategory(intents: readonly RouteCategory[]): RouteCategory {
  for (const category of ROUTE_CATEGORIES) {
    if (intents.includes(category)) return category;
  }
  // Unreachable for schema-valid output (min 1). Fail towards the safest generated path.
  return "medical";
}

export function toRoute(output: RouterOutput): Route {
  return {
    language: output.language,
    category: resolveCategory(output.intents),
    topic: output.topic,
  };
}

export type RouteInput = {
  question: string;
};

export async function routeQuestion(
  _input: RouteInput,
  _ctx: RequestContext,
): Promise<ModelStep<Route>> {
  // TODO(phase-2): generateText({ model, output: Output.object({ schema: RouterOutputSchema }),
  //   maxOutputTokens: config.limits.maxRouterOutputTokens, maxRetries: config.retry.maxRetries,
  //   abortSignal: stageSignal(ctx, config.timeouts.routerMs) }), then toRoute(); map errors to
  //   FailureReason and ALWAYS return the call metadata, also on failure.
  throw new NotImplementedError("router.routeQuestion");
}
