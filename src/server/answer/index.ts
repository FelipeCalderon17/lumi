import type { KnowledgeBase } from "../knowledge";
import type { FailureReason, Language } from "../types";
import { NotImplementedError } from "../types";

/**
 * Answer: streams a reply grounded ONLY in the knowledge base (ADR 0002).
 *
 * Prompt layout, ordered for OpenAI's automatic prefix caching:
 *   1. system rules (static)          ┐ stable prefix → cached
 *   2. the whole KB with handles      ┘
 *   3. the parent's question           ← only this part changes
 *
 * The model must cite handles like [2] or abstain with ABSTAIN_MARKER as its first token.
 */

export const ABSTAIN_MARKER = "[[NO_ANSWER]]";

/** `medical` never gives advice: it points to the care team and helps draft questions for them. */
export type AnswerMode = "practical" | "medical_prep";

export type AnswerInput = {
  question: string;
  language: Language;
  mode: AnswerMode;
  kb: KnowledgeBase;
  abortSignal?: AbortSignal;
};

export type AnswerUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

export type AnswerOutcome =
  | { ok: true; text: string; usage: AnswerUsage }
  | { ok: false; reason: FailureReason };

export type AnswerStream = {
  textStream: AsyncIterable<string>;
  /** Resolves once the stream ends, with the full text for citation validation. */
  outcome: Promise<AnswerOutcome>;
};

export function buildSystemPrefix(_kb: KnowledgeBase): string {
  // TODO(phase-2): static rules + KB rendered as "[n] title\nbody" blocks. Must be deterministic.
  throw new NotImplementedError("answer.buildSystemPrefix");
}

export function streamAnswer(_input: AnswerInput): AnswerStream {
  // TODO(phase-2): streamText({ model, system: buildSystemPrefix(kb), prompt: question,
  //   maxOutputTokens, maxRetries: config.retry.maxRetries, abortSignal }) and read
  //   usage.inputTokenDetails.cacheReadTokens for the ledger.
  throw new NotImplementedError("answer.streamAnswer");
}
