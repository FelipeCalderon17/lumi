import type { RequestContext } from "../context";
import type { KnowledgeBase } from "../knowledge";
import type { FinishReason, Language, ModelStep, StepResult } from "../types";
import { NotImplementedError } from "../types";

/**
 * Answer: a reply grounded ONLY in the knowledge base (ADR 0002), for `practical` questions.
 * Medical questions never reach this module: they get a fixed template (ADR 0010).
 *
 * Prompt layout, ordered for OpenAI's automatic prefix caching (not guaranteed; measured):
 *   1. policy: system rules (static, instructions)            ┐ stable prefix
 *   2. <reference_data> the whole KB with handles </...>      ┘ marked as DATA, not instructions
 *   3. the parent's question, in its own delimited block       ← only this part changes
 *
 * The model must cite handles like [2] or abstain with ABSTAIN_MARKER as its first token.
 * The text is BUFFERED: it streams from the provider (so a stall is detected early) but is
 * only revealed to the parent after interpretCompletion + citation integrity pass.
 */

export const ABSTAIN_MARKER = "[[NO_ANSWER]]";

export type AnswerInput = {
  question: string;
  language: Language;
  kb: KnowledgeBase;
};

/** A complete, untruncated model reply, before citation checks. */
export type AnswerDraft = { kind: "answer"; text: string } | { kind: "abstained" };

/**
 * Decide what a finished, fully buffered completion means. Works on the WHOLE text, so an
 * abstain marker split across chunks ("[[NO_" + "ANSWER]]") is still recognised.
 *
 * - finishReason "length"  → truncated (never shown, even with valid citations)
 * - anything but "stop"    → interrupted
 * - marker first           → abstained (any text after it is discarded)
 * - marker anywhere else   → invalid_output (the model hedged mid-answer)
 * - empty text             → invalid_output
 */
export function interpretCompletion(
  text: string,
  finishReason: FinishReason,
): StepResult<AnswerDraft> {
  if (finishReason === "length") return { ok: false, reason: "truncated" };
  if (finishReason !== "stop") return { ok: false, reason: "interrupted" };

  const trimmed = text.trim();
  if (trimmed.startsWith(ABSTAIN_MARKER)) return { ok: true, value: { kind: "abstained" } };
  if (trimmed.includes(ABSTAIN_MARKER) || trimmed === "") {
    return { ok: false, reason: "invalid_output" };
  }
  return { ok: true, value: { kind: "answer", text: trimmed } };
}

export function buildSystemPrefix(_kb: KnowledgeBase): string {
  // TODO(phase-2): policy text, then the KB inside a <reference_data> block that says it is
  //   data, not instructions, rendered as "[n] title\nbody". Deterministic for the same KB.
  throw new NotImplementedError("answer.buildSystemPrefix");
}

export async function generateAnswer(
  _input: AnswerInput,
  _ctx: RequestContext,
): Promise<ModelStep<AnswerDraft>> {
  // TODO(phase-2): streamText({ model, system: buildSystemPrefix(kb), prompt: <question block>,
  //   maxOutputTokens, maxRetries: config.retry.maxRetries,
  //   abortSignal: stageSignal(ctx, config.timeouts.answerTotalMs) }) with a first-token timer;
  //   buffer the text, then interpretCompletion(text, finishReason). Return call metadata
  //   (usage.inputTokenDetails.cacheReadTokens → cachedInputTokens; undefined → null) always.
  throw new NotImplementedError("answer.generateAnswer");
}
