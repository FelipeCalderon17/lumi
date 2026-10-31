import { buildQuestionBlock, buildSystemPrefix } from "../../src/server/answer";
import { config, type ModelId, type PriceCatalog } from "../../src/server/config";
import type { KnowledgeBase } from "../../src/server/knowledge";
import { buildNotesBlock, NOTEBOOK_SYSTEM } from "../../src/server/notebook";
import { ROUTER_SYSTEM } from "../../src/server/router";
import { checkEmergency } from "../../src/server/safety";
import type { Language } from "../../src/server/types";
import type { GoldenCase } from "../golden";
import type { NotebookCase } from "../notebook";
import { type CallEstimate, type Estimate, estimateCalls, tokensFromChars } from "./budget";
import { acceptableOutcomes } from "./checks";
import { JUDGE_SYSTEM, type JudgeMode } from "./judge";
import type { EvalOptions } from "./options";

/**
 * The run plan: every unit of work in PRIORITY order (first arm × every run, then the
 * notebook, then the other arms), with token estimates for the budget guard.
 */
export type ChatUnit = {
  kind: "chat";
  arm: ModelId;
  armIndex: number;
  case: GoldenCase;
  run: number;
  /** What the judge does if the run ends in a generated answer. */
  judge: JudgeMode | "none";
};
export type NotebookUnit = { kind: "notebook"; case: NotebookCase };
export type Unit = ChatUnit | NotebookUnit;

export type Plan = {
  units: Unit[];
  /** Arms left out before any call (unknown price), with why. */
  skippedArms: { arm: ModelId; reason: string }[];
};

/** The language the answer is expected in: what picks the KB and the cache prefix. */
export function answerLanguage(c: GoldenCase): Language {
  return c.expect.language ?? c.locale;
}

export function runsFor(arm: ModelId, armIndex: number, opts: EvalOptions): number {
  if (armIndex === 0) return opts.firstArmRuns;
  const runs: Partial<Record<ModelId, number>> = config.evals.runsPerCase;
  return runs[arm] ?? config.evals.runsPerCase.default;
}

export function buildPlan(
  opts: EvalOptions,
  golden: readonly GoldenCase[],
  notebook: readonly NotebookCase[],
  catalog: PriceCatalog,
): Plan {
  const filtered = golden.filter((c) => !opts.casePattern || opts.casePattern.test(c.id));
  const cases = opts.limit ? filtered.slice(0, opts.limit) : filtered;
  const units: Unit[] = [];
  const skippedArms: Plan["skippedArms"] = [];
  const arms = opts.arms.filter((arm) => {
    const price = catalog[arm];
    if (
      price.billing === "tokens" &&
      price.inputUsdPerMillion !== null &&
      price.outputUsdPerMillion !== null
    ) {
      return true;
    }
    skippedArms.push({ arm, reason: "no price in the catalog, so the cost can't be estimated" });
    return false;
  });

  const answerStep = new Set<string>(config.evals.answerStepTags);
  const chatUnits = (arm: ModelId, armIndex: number) => {
    const armCases =
      armIndex === 0 || opts.allCasesAllArms
        ? cases
        : cases.filter((c) => c.tags.some((t) => answerStep.has(t)));
    const runs = runsFor(arm, armIndex, opts);
    for (let run = 1; run <= runs; run++) {
      for (const c of armCases) {
        const judged = opts.judge === "all" || (opts.judge === "first" && run === 1);
        units.push({
          kind: "chat",
          arm,
          armIndex,
          case: c,
          run,
          judge: !judged ? "none" : c.expect.judge ? "rubric" : "groundedness",
        });
      }
    }
  };

  const [first, ...rest] = arms;
  if (first) chatUnits(first, 0);
  if (opts.notebook) {
    const notebookCases = notebook.filter((c) => !opts.casePattern || opts.casePattern.test(c.id));
    for (const c of opts.limit ? notebookCases.slice(0, opts.limit) : notebookCases) {
      units.push({ kind: "notebook", case: c });
    }
  }
  for (const [i, arm] of rest.entries()) chatUnits(arm, i + 1);
  return { units, skippedArms };
}

/** Sizes the estimator needs, computed once from the real prompts and KB. */
export type PromptSizes = {
  answerPrefixChars: Record<Language, number>;
  articleChars: Record<Language, Map<string, number>>;
  /** Chars of the two longest articles, per language: the judge's worst case without articles. */
  twoLongestChars: Record<Language, number>;
};

export function promptSizes(kbs: Record<Language, KnowledgeBase>): PromptSizes {
  const sizes = (kb: KnowledgeBase) =>
    new Map(kb.articles.map((a) => [a.id, a.title.length + a.body.length + 40]));
  const twoLongest = (kb: KnowledgeBase) =>
    [...sizes(kb).values()]
      .sort((a, b) => b - a)
      .slice(0, 2)
      .reduce((s, n) => s + n, 0);
  return {
    answerPrefixChars: {
      en: buildSystemPrefix(kbs.en).length,
      es: buildSystemPrefix(kbs.es).length,
    },
    articleChars: { en: sizes(kbs.en), es: sizes(kbs.es) },
    twoLongestChars: { en: twoLongest(kbs.en), es: twoLongest(kbs.es) },
  };
}

/** Rough visible answer length, for the judge's input estimate (the prompt asks for ≤ ~150 words). */
const ANSWER_CHARS_FOR_JUDGE = 1_400;
/** The judge prompt's own wrapper text around question, answer and articles. */
const JUDGE_WRAPPER_CHARS = 400;

/**
 * The calls the expected path makes, for the PRE-RUN estimate only. The runtime guard reserves
 * upper bounds built from the actual requests instead (bounds.ts).
 */
export type UnitCalls = { expected: CallEstimate[] };

export function unitCalls(unit: Unit, sizes: PromptSizes): UnitCalls {
  const { charsPerToken, outputTokens } = config.evals.estimate;
  const t = (chars: number) => tokensFromChars(chars, charsPerToken);
  if (unit.kind === "notebook") {
    const input = t(
      NOTEBOOK_SYSTEM.length + buildNotesBlock(unit.case.notes, unit.case.locale).length,
    );
    const call: CallEstimate = {
      step: "notebook",
      model: config.models.notebook,
      inputTokens: input,
      prefixTokens: t(NOTEBOOK_SYSTEM.length),
      prefixKey: "notebook",
      expectedOutputTokens: outputTokens.notebook,
      maxOutputTokens: config.limits.maxNotebookOutputTokens,
    };
    return { expected: [call] };
  }

  const c = unit.case;
  if (checkEmergency(c.input).triggered) return { expected: [] };
  const language = answerLanguage(c);
  const router: CallEstimate = {
    step: "router",
    model: config.models.router,
    inputTokens: t(ROUTER_SYSTEM.length + c.input.length + 30),
    prefixTokens: t(ROUTER_SYSTEM.length),
    prefixKey: "router",
    expectedOutputTokens: outputTokens.router,
    maxOutputTokens: config.limits.maxRouterOutputTokens,
  };
  const answer: CallEstimate = {
    step: "answer",
    model: unit.arm,
    inputTokens: t(sizes.answerPrefixChars[language] + buildQuestionBlock(c.input).length),
    prefixTokens: t(sizes.answerPrefixChars[language]),
    prefixKey: `answer-${language}`,
    expectedOutputTokens: outputTokens.answer,
    maxOutputTokens: config.limits.maxAnswerOutputTokens,
  };
  const outcomes = acceptableOutcomes(c);
  const reachesAnswer = outcomes.includes("answer") || outcomes.includes("abstained");
  const articleChars = c.expect.articles
    ? c.expect.articles.reduce((s, id) => s + (sizes.articleChars[language].get(id) ?? 0), 0)
    : sizes.twoLongestChars[language];
  const judge: CallEstimate | null =
    unit.judge === "none"
      ? null
      : {
          step: "judge",
          model: config.models.judge,
          inputTokens: t(
            JUDGE_SYSTEM.length +
              JUDGE_WRAPPER_CHARS +
              c.input.length +
              ANSWER_CHARS_FOR_JUDGE +
              articleChars,
          ),
          prefixTokens: t(JUDGE_SYSTEM.length),
          prefixKey: "judge",
          expectedOutputTokens: outputTokens.judge,
          maxOutputTokens: config.evals.judge.maxOutputTokens,
        };
  return {
    expected: [
      router,
      ...(reachesAnswer ? [answer] : []),
      ...(judge && outcomes.includes("answer") ? [judge] : []),
    ],
  };
}

export type PlanEstimate = {
  sections: { label: string; units: number; estimate: Estimate }[];
  total: Estimate;
};

/** Section label for the per-arm breakdown the dry run prints. */
function sectionOf(unit: Unit, step: CallEstimate["step"]): string {
  if (unit.kind === "notebook") return "notebook";
  return step === "judge" ? `${unit.arm} · judge` : `${unit.arm} · pipeline`;
}

export function estimatePlan(plan: Plan, sizes: PromptSizes, catalog: PriceCatalog): PlanEstimate {
  const { warmCachedShare, minCacheablePrefixTokens } = config.evals.estimate;
  const opts = { warmCachedShare, minCacheablePrefixTokens };
  const bySection = new Map<string, { calls: CallEstimate[]; units: Set<Unit> }>();
  const all: CallEstimate[] = [];
  for (const unit of plan.units) {
    for (const call of unitCalls(unit, sizes).expected) {
      const label = sectionOf(unit, call.step);
      const entry = bySection.get(label) ?? { calls: [], units: new Set() };
      entry.calls.push(call);
      entry.units.add(unit);
      bySection.set(label, entry);
      all.push(call);
    }
  }
  return {
    sections: [...bySection.entries()].map(([label, { calls, units }]) => ({
      label,
      units: units.size,
      estimate: estimateCalls(calls, catalog, opts),
    })),
    total: estimateCalls(all, catalog, opts),
  };
}

/**
 * Fits a plan to the budget in priority order: while the warm estimate is above the cap, the
 * LAST answer arm is dropped whole (a half-run arm can't be compared). The first arm and the
 * notebook are never dropped here; if they alone don't fit, `fits` is false and the run aborts.
 */
export function fitPlanToBudget(
  plan: Plan,
  sizes: PromptSizes,
  catalog: PriceCatalog,
  capUsd: number,
): { plan: Plan; estimate: PlanEstimate; droppedArms: ModelId[]; fits: boolean } {
  let current = plan;
  const droppedArms: ModelId[] = [];
  let estimate = estimatePlan(current, sizes, catalog);
  while (estimate.total.warm > capUsd) {
    const arms = [...new Set(current.units.flatMap((u) => (u.kind === "chat" ? [u] : [])))];
    const last = arms.reduce<ChatUnit | null>(
      (max, u) => (max === null || u.armIndex > max.armIndex ? u : max),
      null,
    );
    if (!last || last.armIndex === 0) break;
    droppedArms.push(last.arm);
    current = {
      ...current,
      units: current.units.filter((u) => u.kind !== "chat" || u.arm !== last.arm),
    };
    estimate = estimatePlan(current, sizes, catalog);
  }
  return { plan: current, estimate, droppedArms, fits: estimate.total.warm <= capUsd };
}
