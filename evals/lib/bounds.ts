import { buildQuestionBlock, buildSystemPrefix } from "../../src/server/answer";
import { config, type ModelId, type PriceCatalog } from "../../src/server/config";
import type { KnowledgeBase } from "../../src/server/knowledge";
import { estimateCost } from "../../src/server/ledger";
import { stripPromptTags } from "../../src/server/models";
import { buildNotesBlock, NOTEBOOK_SYSTEM, type Note } from "../../src/server/notebook";
import { ROUTER_SYSTEM } from "../../src/server/router";
import type { Language } from "../../src/server/types";
import { buildJudgePrompt, JUDGE_SYSTEM, type JudgeInput } from "./judge";

/**
 * Runtime reservations for the budget guard (Codex review, Phase 4 fixes round 1). Unlike the
 * pre-run estimate (plan.ts), these are UPPER BOUNDS for the complete request, built from the
 * ACTUAL text that will be sent:
 *
 *   attempts × price(input = chars / guard.charsPerToken + guard.requestOverheadTokens,
 *                    cached = 0, output = the step's maxOutputTokens)
 *
 * with attempts = maxRetries + 1. A call can't cost more than this unless its prompt tokenizes
 * at fewer than `guard.charsPerToken` characters per token (measured 4.5–4.8 for EN/ES).
 */
export type CallBound = {
  model: ModelId;
  promptChars: number;
  maxOutputTokens: number;
};

export function boundInputTokens(promptChars: number): number {
  const { charsPerToken, requestOverheadTokens } = config.evals.guard;
  return Math.ceil(promptChars / charsPerToken) + requestOverheadTokens;
}

/** USD upper bound for one call, all attempts included; Infinity if the price is unknown. */
export function boundUsd(bound: CallBound, catalog: PriceCatalog): number {
  const once = estimateCost(
    {
      model: bound.model,
      inputTokens: boundInputTokens(bound.promptChars),
      cachedInputTokens: 0,
      outputTokens: bound.maxOutputTokens,
      audioSeconds: null,
    },
    catalog,
  );
  if (once === "unknown") return Number.POSITIVE_INFINITY;
  return once * (config.retry.maxRetries + 1);
}

export function routerBound(message: string): CallBound {
  return {
    model: config.models.router,
    promptChars: ROUTER_SYSTEM.length + `<message>\n${stripPromptTags(message)}\n</message>`.length,
    maxOutputTokens: config.limits.maxRouterOutputTokens,
  };
}

/** The answer's language is only known after the router, so take the larger KB prefix. */
export function answerBound(
  model: ModelId,
  message: string,
  kbs: Record<Language, KnowledgeBase>,
): CallBound {
  const prefix = Math.max(buildSystemPrefix(kbs.en).length, buildSystemPrefix(kbs.es).length);
  return {
    model,
    promptChars: prefix + buildQuestionBlock(message).length,
    maxOutputTokens: config.limits.maxAnswerOutputTokens,
  };
}

export function notebookBound(notes: readonly Note[], locale: Language): CallBound {
  return {
    model: config.models.notebook,
    promptChars: NOTEBOOK_SYSTEM.length + buildNotesBlock(notes, locale).length,
    maxOutputTokens: config.limits.maxNotebookOutputTokens,
  };
}

/** Built from the exact judge request: the real answer and the real cited articles. */
export function judgeBound(input: JudgeInput): CallBound {
  return {
    model: config.models.judge,
    promptChars: JUDGE_SYSTEM.length + buildJudgePrompt(input).length,
    maxOutputTokens: config.evals.judge.maxOutputTokens,
  };
}
