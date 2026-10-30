import type { KbTopic } from "./knowledge";
import type { EmergencyKind } from "./safety";
import type { FailureReason, Language } from "./types";

/**
 * The chat transport contract (docs/ARCHITECTURE.md § Transport, ADR 0010): zero or more
 * `progress` events, then EXACTLY ONE terminal event. Kept apart from pipeline.ts so the
 * ledger and the DB schema can import it without an import cycle.
 */

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
