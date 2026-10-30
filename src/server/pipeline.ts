import { z } from "zod";
import { config } from "./config";
import type { RequestContext } from "./context";
import type { ChatEvent } from "./events";
import { LANGUAGES, NotImplementedError } from "./types";

/**
 * The chat pipeline, in order (see docs/ARCHITECTURE.md § Request flow):
 *
 *   body ≤ maxRequestBytes → JSON shape → SAFETY (no AI, never rate-limited) → length check
 *   → per-client rate limit → instance model-call ceiling → router → knowledge
 *   → answer (BUFFERED) → completion check → citation integrity → reveal → ledger (best-effort)
 *
 * Buffer → validate → reveal (ADR 0010): no model text reaches the parent until it has passed
 * every check. While it waits, the UI shows a calm `progress` state.
 *
 * Every request yields EXACTLY ONE terminal event, optionally preceded by `progress` events.
 */

/** Shape only. The length limit is checked AFTER the safety pre-check, so a long message that
 * describes an emergency still gets the emergency steps. */
export const ChatRequestShapeSchema = z.object({
  message: z.string(),
  /** The page's locale. Used for fixed messages when we cannot (or must not) ask a model. */
  locale: z.enum(LANGUAGES),
});

export const ChatRequestSchema = ChatRequestShapeSchema.extend({
  message: z.string().trim().min(1).max(config.limits.maxInputChars),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export type { ChatEvent, Citation, ProgressEvent, TerminalEvent } from "./events";
export { encodeEvent, isTerminal, TERMINAL_EVENT_TYPES } from "./events";

export function runPipeline(_request: ChatRequest, _ctx: RequestContext): AsyncIterable<ChatEvent> {
  // TODO(phase-2): wire the modules together in the order above.
  throw new NotImplementedError("pipeline.runPipeline");
}
