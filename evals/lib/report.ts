import { config, type ModelId, type PriceCatalog } from "../../src/server/config";
import {
  addCosts,
  type CostEstimate,
  estimateCost,
  type UsageEntry,
} from "../../src/server/ledger";
import type { NotebookTopic } from "../../src/server/notebook";
import type { GoldenCase } from "../golden";
import {
  acceptableOutcomes,
  CHECK_NAMES,
  type CheckName,
  SAFETY_GATE_TAGS,
  terminalOf,
} from "./checks";
import { rubricPass } from "./judge";
import type { ChatRecord, NotebookRecord, RunRecord } from "./runner";
import { WITHHOLDING_LAYERS, type WithholdingLayer } from "./withholding";

/** Aggregation of a run's records into the numbers EVALS.md reports. Pure. */

export type Rate = { pass: number; total: number };
export type Dist = { n: number; p50: number | null; p95: number | null; max: number | null };

/** Nearest-rank percentile of `values` (p in 0..100). `null` for no values. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1] ?? null;
}

export function dist(values: readonly number[]): Dist {
  return {
    n: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: values.length ? Math.max(...values) : null,
  };
}

const rate = (pass: number, total: number): Rate => ({ pass, total });
const add = (r: Rate, ok: boolean) => {
  r.total += 1;
  if (ok) r.pass += 1;
};

export function pct(r: Rate): string {
  return r.total === 0 ? "n/a" : `${((r.pass / r.total) * 100).toFixed(1)}% (${r.pass}/${r.total})`;
}

export type FailureEntry = {
  caseId: string;
  run: number;
  failed: string[];
  outcome: string;
  excerpt: string;
};

export type WithholdingSample = {
  arm: ModelId;
  caseId: string;
  run: number;
  layer: WithholdingLayer;
  layers: WithholdingLayer[];
  matches: string[];
  draft: string;
  judgeUnsupported: number | null;
};

export type ArmSummary = {
  arm: ModelId;
  runs: number;
  skipped: number;
  passAll: Rate;
  checks: Partial<Record<CheckName, Rate>>;
  categories: { tag: string; rate: Rate }[];
  safetyGate: { tag: string; rate: Rate }[];
  safetyGateAll: Rate;
  groundedAccuracy: Rate;
  abstention: { notInKb: Rate; answerable: Rate; overall: Rate };
  judge: {
    /** Revealed answers the plan asked to judge that got a verdict (errors, skips = gaps). */
    coverage: Rate;
    groundedness: Rate;
    groundednessDrafts: Rate;
    rubric: Rate;
    means: {
      boundary: number | null;
      tone: number | null;
      usefulness: number | null;
      spanish: number | null;
    };
    spanishN: number;
    errors: number;
    skippedBudget: number;
    unsupported: { caseId: string; run: number; claims: string[] }[];
    lowScores: { caseId: string; run: number; criterion: string; score: number; reason: string }[];
    costUsd: CostEstimate;
  };
  /**
   * "Answer-step requests" = requests that reached the answer model: revealed answers, drafts an
   * output check withheld, abstentions and answer-step failures (e.g. a timeout).
   */
  latency: { router: Dist; answer: Dist; totalAnswerStep: Dist; totalAll: Dist };
  tokens: {
    input: number;
    cached: number;
    output: number;
    reasoning: number;
    answerCachedShare: number | null;
  };
  outputCaps: {
    step: "router" | "answer";
    cap: number;
    output: Dist;
    reasoning: Dist;
    truncated: number;
  }[];
  cost: {
    actualUsd: CostEstimate;
    /** Calls left out of every cost here because the provider reported no usage. */
    unknownUsageCalls: number;
    perConversation: CostEstimate;
    perAnswerStep: { actual: CostEstimate; cold: CostEstimate; warm: CostEstimate; n: number };
  };
  reliability: {
    fallbacks: Record<string, number>;
    providerErrors: number;
    unstableCases: string[];
  };
  withholding: {
    eligible: number;
    withheld: number;
    byFirstLayer: Partial<Record<WithholdingLayer, number>>;
    byAnyLayer: Partial<Record<WithholdingLayer, number>>;
    samples: WithholdingSample[];
  };
  failures: FailureEntry[];
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** A call whose token usage the provider reported (a timed-out stream reports none). */
const knownUsage = (row: UsageEntry) =>
  row.inputTokens !== null && row.cachedInputTokens !== null && row.outputTokens !== null;

/**
 * Cost of the calls with known usage. Calls with unknown usage are left out and counted
 * separately (`unknownUsageCalls`): the guard charged them at their full reservation.
 */
function costOf(
  rows: readonly UsageEntry[],
  catalog: PriceCatalog,
  cached?: (row: UsageEntry) => number,
) {
  return rows.filter(knownUsage).reduce<CostEstimate>((sum, row) => {
    const facts =
      cached && row.inputTokens !== null
        ? { ...row, cachedInputTokens: Math.min(row.inputTokens, cached(row)) }
        : row;
    return addCosts(sum, estimateCost(facts, catalog));
  }, 0);
}

const divide = (c: CostEstimate, n: number): CostEstimate => (c === "unknown" ? c : n ? c / n : 0);

export function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function outcomeLabel(r: ChatRecord): string {
  const t = terminalOf(r.events);
  if (!t) return r.rejected ? `rejected(${r.rejected})` : "none";
  if (t.type === "fallback") return `fallback(${t.reason})`;
  if (t.type === "emergency") return `emergency/${t.kind}/${t.detectedBy}`;
  return t.type;
}

export function summarizeArm(
  arm: ModelId,
  records: readonly ChatRecord[],
  cases: ReadonlyMap<string, GoldenCase>,
  catalog: PriceCatalog,
): ArmSummary {
  const all = records.filter((r) => r.arm === arm);
  const done = all.filter((r) => r.status === "done");
  const checks: Partial<Record<CheckName, Rate>> = {};
  const categories = new Map<string, Rate>();
  const gate = new Map<string, Rate>(SAFETY_GATE_TAGS.map((t) => [t, rate(0, 0)]));
  const safetyGateAll = rate(0, 0);
  const passAll = rate(0, 0);
  const grounded = rate(0, 0);
  const notInKb = rate(0, 0);
  const answerable = rate(0, 0);
  const groundedness = rate(0, 0);
  const groundednessDrafts = rate(0, 0);
  const rubric = rate(0, 0);
  const judgeCoverage = rate(0, 0);
  const scores = {
    boundary: [] as number[],
    tone: [] as number[],
    usefulness: [] as number[],
    spanish: [] as number[],
  };
  const unsupported: ArmSummary["judge"]["unsupported"] = [];
  const lowScores: ArmSummary["judge"]["lowScores"] = [];
  let judgeErrors = 0;
  let judgeSkipped = 0;
  let judgeCost: CostEstimate = 0;
  const fallbacks: Record<string, number> = {};
  let providerErrors = 0;
  const failures: FailureEntry[] = [];
  const byFirst: Partial<Record<WithholdingLayer, number>> = {};
  const byAny: Partial<Record<WithholdingLayer, number>> = {};
  const samples: WithholdingSample[] = [];
  let eligible = 0;
  let withheld = 0;

  for (const r of done) {
    const c = cases.get(r.caseId);
    if (!c) continue;
    const terminal = terminalOf(r.events);
    add(passAll, r.pass);
    for (const check of r.checks) {
      checks[check.name] ??= rate(0, 0);
      add(checks[check.name] as Rate, check.pass);
    }
    const tag = c.tags[0] ?? "untagged";
    if (!categories.has(tag)) categories.set(tag, rate(0, 0));
    add(categories.get(tag) as Rate, r.pass);
    const gateTags = c.tags.filter((t) => gate.has(t));
    for (const t of gateTags) add(gate.get(t) as Rate, r.gatePass);
    if (gateTags.length) add(safetyGateAll, r.gatePass);

    if (!r.pass) {
      const text =
        terminal?.type === "answer"
          ? terminal.text
          : (r.answerDraft ?? (r.route ? `router: ${r.route.intents.join("+")}` : ""));
      failures.push({
        caseId: r.caseId,
        run: r.run,
        failed: r.checks
          .filter((x) => !x.pass)
          .map((x) => `${x.name}${x.detail ? ` (${x.detail})` : ""}`),
        outcome: outcomeLabel(r),
        excerpt: excerpt(text),
      });
    }

    const outcomes = acceptableOutcomes(c);
    if (c.tags.includes("not-in-kb")) add(notInKb, terminal?.type === "abstained");
    if (outcomes.includes("answer") && !outcomes.includes("abstained")) {
      add(answerable, terminal?.type !== "abstained");
    }

    // Judge.
    const j = r.judge;
    // Records written before judgeMode existed came from judge=all runs.
    const judgeExpected = terminal?.type === "answer" && (r.judgeMode ?? "groundedness") !== "none";
    if (judgeExpected) add(judgeCoverage, j?.target === "answer" && j.verdict !== null);
    if (r.judgeSkipped === "budget") judgeSkipped += 1;
    if (j) {
      judgeCost = addCosts(judgeCost, estimateCost(j.call, catalog));
      if (j.error || !j.verdict) judgeErrors += 1;
      else if (j.target === "withheld_draft") {
        add(groundednessDrafts, j.verdict.unsupportedClaims.length === 0);
      } else {
        const ok = j.verdict.unsupportedClaims.length === 0;
        add(groundedness, ok);
        if (!ok) {
          unsupported.push({
            caseId: r.caseId,
            run: r.run,
            claims: j.verdict.unsupportedClaims.map((x) => `${x.claim} (${x.reason})`),
          });
        }
        const rb = j.verdict.rubric;
        if (rb) {
          add(rubric, rubricPass(j.verdict) === true);
          for (const [name, criterion] of Object.entries(rb)) {
            if (!criterion) continue;
            scores[name as keyof typeof scores].push(criterion.score);
            if (criterion.score < 3) {
              lowScores.push({
                caseId: r.caseId,
                run: r.run,
                criterion: name,
                score: criterion.score,
                reason: criterion.reason,
              });
            }
          }
        }
      }
    }

    // Grounded accuracy: practical cases, judged where an answer was generated.
    if (c.tags.includes("practical")) {
      const outcomeOk = r.checks.find((x) => x.name === "outcome")?.pass ?? false;
      if (terminal?.type === "answer") {
        const judged = j?.target === "answer" && j.verdict;
        if (judged) {
          const det = ["citations", "articles"].every(
            (n) => r.checks.find((x) => x.name === n)?.pass ?? true,
          );
          add(grounded, outcomeOk && det && j.verdict?.unsupportedClaims.length === 0);
        } else if (judgeExpected) {
          // A missing or failed judge result counts against, never out of, the denominator.
          add(grounded, false);
        }
      } else {
        add(grounded, outcomeOk);
      }
    }

    if (terminal?.type === "fallback")
      fallbacks[terminal.reason] = (fallbacks[terminal.reason] ?? 0) + 1;
    if (r.providerError) providerErrors += 1;

    // Withholding: drafts that are answers (revealed, or withheld by a gate).
    const answerRow = r.rows.find((x) => x.step === "answer");
    if (answerRow) {
      const outputCheck =
        terminal?.type === "fallback" &&
        (terminal.reason === "invalid_output" || terminal.reason === "truncated");
      if (terminal?.type === "answer") eligible += 1;
      else if (r.withholding && outputCheck) {
        eligible += 1;
        withheld += 1;
        byFirst[r.withholding.first] = (byFirst[r.withholding.first] ?? 0) + 1;
        for (const l of r.withholding.layers) byAny[l] = (byAny[l] ?? 0) + 1;
        samples.push({
          arm,
          caseId: r.caseId,
          run: r.run,
          layer: r.withholding.first,
          layers: r.withholding.layers,
          matches: [
            ...r.withholding.unsafeMatches,
            ...r.withholding.unsourced.map((u) => `unsourced: ${u}`),
          ],
          draft: r.answerDraft ?? "",
          judgeUnsupported:
            j?.target === "withheld_draft" && j.verdict ? j.verdict.unsupportedClaims.length : null,
        });
      }
    }
  }

  // Variance across runs: cases whose outcome differs between runs.
  const outcomesByCase = new Map<string, Set<string>>();
  for (const r of done) {
    const set = outcomesByCase.get(r.caseId) ?? new Set<string>();
    set.add(outcomeLabel(r));
    outcomesByCase.set(r.caseId, set);
  }
  const unstableCases = [...outcomesByCase.entries()]
    .filter(([, set]) => set.size > 1)
    .map(([id, set]) => `${id}: ${[...set].join(" / ")}`);

  const rows = done.flatMap((r) =>
    r.rows.map((row) => ({ row, language: r.route?.language ?? r.locale })),
  );
  const routerRows = rows.filter((x) => x.row.step === "router").map((x) => x.row);
  const answerRows = rows.filter((x) => x.row.step === "answer").map((x) => x.row);
  const answerStep = done.filter((r) => r.rows.some((x) => x.step === "answer"));

  // Warm cost: each call's input cached up to the most this step/model/language was seen cached.
  const maxCached = new Map<string, number>();
  for (const { row, language } of rows) {
    const key = `${row.step}|${row.model}|${language}`;
    maxCached.set(key, Math.max(maxCached.get(key) ?? 0, row.cachedInputTokens ?? 0));
  }
  const answerStepRows = answerStep.flatMap((r) =>
    r.rows.map((row) => ({ row, language: r.route?.language ?? r.locale })),
  );
  const actualAnswerStep = costOf(
    answerStepRows.map((x) => x.row),
    catalog,
  );
  const coldAnswerStep = costOf(
    answerStepRows.map((x) => x.row),
    catalog,
    () => 0,
  );
  const warmAnswerStep = answerStepRows.reduce<CostEstimate>((sum, { row, language }) => {
    const cached = maxCached.get(`${row.step}|${row.model}|${language}`) ?? 0;
    return addCosts(
      sum,
      costOf([row], catalog, () => cached),
    );
  }, 0);
  const actual = costOf(
    rows.map((x) => x.row),
    catalog,
  );

  const sum = (xs: UsageEntry[], f: (r: UsageEntry) => number | null) =>
    xs.reduce((s, r) => s + (f(r) ?? 0), 0);
  const answerInput = sum(answerRows, (r) => r.inputTokens);
  const capFor = (step: "router" | "answer") =>
    step === "router" ? config.limits.maxRouterOutputTokens : config.limits.maxAnswerOutputTokens;

  return {
    arm,
    runs: done.length,
    skipped: all.length - done.length,
    passAll,
    checks: Object.fromEntries(CHECK_NAMES.filter((n) => checks[n]).map((n) => [n, checks[n]])),
    categories: [...categories.entries()].map(([tag, r]) => ({ tag, rate: r })),
    safetyGate: [...gate.entries()]
      .filter(([, r]) => r.total > 0)
      .map(([tag, r]) => ({ tag, rate: r })),
    safetyGateAll,
    groundedAccuracy: grounded,
    abstention: {
      notInKb,
      answerable,
      overall: rate(notInKb.pass + answerable.pass, notInKb.total + answerable.total),
    },
    judge: {
      coverage: judgeCoverage,
      groundedness,
      groundednessDrafts,
      rubric,
      means: {
        boundary: mean(scores.boundary),
        tone: mean(scores.tone),
        usefulness: mean(scores.usefulness),
        spanish: mean(scores.spanish),
      },
      spanishN: scores.spanish.length,
      errors: judgeErrors,
      skippedBudget: judgeSkipped,
      unsupported,
      lowScores,
      costUsd: judgeCost,
    },
    latency: {
      router: dist(routerRows.map((r) => r.latencyMs)),
      answer: dist(answerRows.map((r) => r.latencyMs)),
      totalAnswerStep: dist(answerStep.map((r) => r.latency.totalMs)),
      totalAll: dist(done.filter((r) => r.rows.length > 0).map((r) => r.latency.totalMs)),
    },
    tokens: {
      input: sum(
        rows.map((x) => x.row),
        (r) => r.inputTokens,
      ),
      cached: sum(
        rows.map((x) => x.row),
        (r) => r.cachedInputTokens,
      ),
      output: sum(
        rows.map((x) => x.row),
        (r) => r.outputTokens,
      ),
      reasoning: sum(
        rows.map((x) => x.row),
        (r) => r.reasoningTokens,
      ),
      answerCachedShare:
        answerInput > 0 ? sum(answerRows, (r) => r.cachedInputTokens) / answerInput : null,
    },
    outputCaps: (["router", "answer"] as const).map((step) => {
      const stepRows = step === "router" ? routerRows : answerRows;
      return {
        step,
        cap: capFor(step),
        output: dist(stepRows.flatMap((r) => (r.outputTokens === null ? [] : [r.outputTokens]))),
        reasoning: dist(
          stepRows.flatMap((r) => (r.reasoningTokens === null ? [] : [r.reasoningTokens])),
        ),
        truncated: stepRows.filter((r) => r.finishReason === "length").length,
      };
    }),
    cost: {
      actualUsd: actual,
      unknownUsageCalls: rows.filter((x) => !knownUsage(x.row)).length,
      perConversation: divide(actual, done.length),
      perAnswerStep: {
        actual: divide(actualAnswerStep, answerStep.length),
        cold: divide(coldAnswerStep, answerStep.length),
        warm: divide(warmAnswerStep, answerStep.length),
        n: answerStep.length,
      },
    },
    reliability: { fallbacks, providerErrors, unstableCases },
    withholding: { eligible, withheld, byFirstLayer: byFirst, byAnyLayer: byAny, samples },
    failures,
  };
}

export type NotebookSummary = {
  cases: number;
  skipped: number;
  outcome: Rate;
  verbatim: Rate;
  safetyNotices: Rate;
  questions: Rate;
  injection: Rate;
  classification: Rate;
  byTopic: { topic: NotebookTopic; rate: Rate }[];
  byLanguage: { language: string; rate: Rate }[];
  misfiled: { caseId: string; index: number; expected: string; got: string | null }[];
  fallbacks: number;
  latency: Dist;
  output: Dist;
  reasoning: Dist;
  truncated: number;
  costUsd: CostEstimate;
  failures: { caseId: string; failed: string[] }[];
};

export function summarizeNotebook(
  records: readonly NotebookRecord[],
  catalog: PriceCatalog,
): NotebookSummary {
  const done = records.filter((r) => r.status === "done");
  const s = {
    outcome: rate(0, 0),
    verbatim: rate(0, 0),
    safetyNotices: rate(0, 0),
    questions: rate(0, 0),
    injection: rate(0, 0),
    classification: rate(0, 0),
  };
  const byTopic = new Map<NotebookTopic, Rate>();
  const byLanguage = new Map<string, Rate>();
  const misfiled: NotebookSummary["misfiled"] = [];
  const failures: NotebookSummary["failures"] = [];
  let fallbacks = 0;
  for (const r of done) {
    if (r.response?.result.kind === "fallback") fallbacks += 1;
    if (!r.check) {
      failures.push({ caseId: r.caseId, failed: ["rejected"] });
      continue;
    }
    for (const c of r.check.checks) add(s[c.name], c.pass);
    const failed = r.check.checks
      .filter((c) => !c.pass)
      .map((c) => `${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    for (const n of r.check.scored) {
      add(s.classification, n.pass);
      if (!byTopic.has(n.expected)) byTopic.set(n.expected, rate(0, 0));
      add(byTopic.get(n.expected) as Rate, n.pass);
      if (!byLanguage.has(r.check.language)) byLanguage.set(r.check.language, rate(0, 0));
      add(byLanguage.get(r.check.language) as Rate, n.pass);
      if (!n.pass) {
        misfiled.push({ caseId: r.caseId, index: n.index, expected: n.expected, got: n.got });
        failed.push(`note ${n.index}: ${n.got} vs ${n.expected}`);
      }
    }
    if (failed.length) failures.push({ caseId: r.caseId, failed });
  }
  const rows = done.flatMap((r) => r.rows);
  return {
    cases: done.length,
    skipped: records.length - done.length,
    ...s,
    byTopic: [...byTopic.entries()].map(([topic, r]) => ({ topic, rate: r })),
    byLanguage: [...byLanguage.entries()].map(([language, r]) => ({ language, rate: r })),
    misfiled,
    fallbacks,
    latency: dist(rows.map((r) => r.latencyMs)),
    output: dist(rows.flatMap((r) => (r.outputTokens === null ? [] : [r.outputTokens]))),
    reasoning: dist(rows.flatMap((r) => (r.reasoningTokens === null ? [] : [r.reasoningTokens]))),
    truncated: rows.filter((r) => r.finishReason === "length").length,
    costUsd: costOf(rows, catalog),
    failures,
  };
}

/** Judge output-token distribution across every judge call (for the cap report). */
export function judgeOutputs(records: readonly RunRecord[]): {
  output: Dist;
  reasoning: Dist;
  truncated: number;
} {
  const calls = records.flatMap((r) => (r.kind === "chat" && r.judge ? [r.judge] : []));
  return {
    output: dist(calls.flatMap((j) => (j.call.outputTokens === null ? [] : [j.call.outputTokens]))),
    reasoning: dist(
      calls.flatMap((j) => (j.call.reasoningTokens === null ? [] : [j.call.reasoningTokens])),
    ),
    truncated: calls.filter((j) => j.error === "truncated").length,
  };
}

export { WITHHOLDING_LAYERS };
