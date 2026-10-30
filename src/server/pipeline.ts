import { z } from "zod";
import { config } from "./config";
import type { RequestContext } from "./context";
import type { KbTopic } from "./knowledge";
import type { EmergencyKind } from "./safety";
import type { FailureReason, Language } from "./types";
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

export type Citation = { handle: number; articleId: string; title: string };

/** Non-terminal: tells the UI the request is alive and what to say while it waits. */
export type ProgressEvent = { type: "progress"; stage: "reading_guides" };

export type TerminalEvent =
  /** Deterministic pre-check (`safety`) or router `urgent` (`router`). Fixed copy: 911 / 988. */
  | { type: "emergency"; kind: EmergencyKind; detectedBy: "safety" | "router"; language: Language }
  /** Fixed calm copy with 988 and human contacts. No generation. */
  | { type: "crisis"; language: Language }
  /** Fixed, reviewed template: ask the care team + link to the curated article. No generation. */
  | { type: "medical"; language: Language; article: Citation }
  | { type: "off_topic"; language: Language }
  /** A validated, grounded answer, revealed in one piece. */
  | { type: "answer"; language: Language; text: string; citations: readonly Citation[] }
  /** The KB does not cover it: say so, show human contacts, offer to save the question. */
  | { type: "abstained"; language: Language; topic: KbTopic | "other" }
  | { type: "fallback"; reason: FailureReason; language: Language };

export type ChatEvent = ProgressEvent | TerminalEvent;

export const TERMINAL_EVENT_TYPES = [
  "emergency",
  "crisis",
  "medical",
  "off_topic",
  "answer",
  "abstained",
  "fallback",
] as const satisfies readonly TerminalEvent["type"][];

export function isTerminal(event: ChatEvent): event is TerminalEvent {
  return (TERMINAL_EVENT_TYPES as readonly string[]).includes(event.type);
}

/**
 * NDJSON framing: one JSON object per line, UTF-8, `\n`-terminated, no blank lines.
 * Content-Type: application/x-ndjson; Cache-Control: no-store.
 */
export function encodeEvent(event: ChatEvent): string {
  return `${JSON.stringify(event)}\n`;
}

export function runPipeline(_request: ChatRequest, _ctx: RequestContext): AsyncIterable<ChatEvent> {
  // TODO(phase-2): wire the modules together in the order above.
  throw new NotImplementedError("pipeline.runPipeline");
}
