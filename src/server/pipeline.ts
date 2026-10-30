import { z } from "zod";
import { config } from "./config";
import type { EmergencyKind } from "./safety";
import type { FailureReason, Language } from "./types";
import { LANGUAGES, NotImplementedError } from "./types";

/**
 * The chat pipeline, in order (see docs/ARCHITECTURE.md):
 *
 *   validate input → rate limit → safety (no AI) → router → knowledge → answer (stream)
 *   → validate citations → ledger
 *
 * Every branch ends in a ChatEvent the UI knows how to render calmly. There is no path
 * that ends in a blank screen or a raw error.
 */

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(config.limits.maxInputChars),
  /** The page's locale. Used for fixed messages when we cannot (or must not) ask a model. */
  locale: z.enum(LANGUAGES),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export type Citation = { handle: number; articleId: string; title: string };

export type ChatEvent =
  | { type: "emergency"; kind: EmergencyKind; language: Language }
  | { type: "crisis"; language: Language }
  | { type: "off_topic"; language: Language }
  | { type: "delta"; text: string }
  | { type: "answer_done"; citations: readonly Citation[] }
  /** The KB does not cover it: say so, show human contacts, offer to save the question. */
  | { type: "abstained"; language: Language; canSaveGap: true }
  | { type: "fallback"; reason: FailureReason; language: Language };

export function runPipeline(_request: ChatRequest): AsyncIterable<ChatEvent> {
  // TODO(phase-1/2): wire the modules together in the order above.
  throw new NotImplementedError("pipeline.runPipeline");
}
