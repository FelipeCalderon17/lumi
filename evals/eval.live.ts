/**
 * `pnpm eval`: the golden-set and notebook evals through the REAL pipeline (docs/EVALS.md).
 * Started by evals/run.ts, which passes the flags in LUMI_EVAL_ARGS. Runs under vitest only to
 * get the same TypeScript resolution as the app; it isn't a test and never runs in `pnpm test`.
 *
 * - `--dry-run` (or no LUMI_LIVE=1): prints the plan and the cost estimate, makes no call.
 * - Live: needs LUMI_LIVE=1 and OPENAI_API_KEY (loaded with --env-file, never read here).
 *   Aborts before any call if the estimate is above the budget cap; stops before any call that
 *   could take the actual spend past it. Writes raw outputs to evals/runs/<timestamp>/.
 * Prints numbers, outcomes and case ids only; never keys or prompts.
 */
import { execSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { config, modelCatalog } from "../src/server/config";
import { fingerprint } from "../src/server/fingerprint";
import { loadKnowledgeBase } from "../src/server/knowledge";
import { createOpenAIProvider } from "../src/server/models";
import { type GoldenCase, GoldenCaseSchema } from "./golden";
import { createBudgetGuard } from "./lib/budget";
import { JUDGE_PROMPT_VERSION } from "./lib/judge";
import { mergeRuns } from "./lib/merge";
import { parseEvalArgs } from "./lib/options";
import { buildPlan, estimatePlan, fitPlanToBudget, promptSizes } from "./lib/plan";
import { redactSecrets } from "./lib/redact";
import { renderResults, renderSafetyReview, usd } from "./lib/render";
import { judgeOutputs, summarizeArm, summarizeNotebook } from "./lib/report";
import { type ChatRecord, executePlan, type NotebookRecord, type RunRecord } from "./lib/runner";
import { NotebookCaseSchema } from "./notebook";

const enabled = process.env.LUMI_EVAL === "1";

/** Everything printed or written goes through redactSecrets (defense in depth). */
const say = (line: string) => console.log(redactSecrets(line));
const write = (file: URL, text: string) => writeFileSync(file, redactSecrets(text));

function readJsonl<T>(file: string, parse: (v: unknown) => T): T[] {
  return readFileSync(new URL(file, import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => parse(JSON.parse(l)));
}

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

type Meta = Parameters<typeof renderSafetyReview>[0];

/** Aggregates records and writes results.md, safety-review.md and summary.json into `dir`. */
function writeReport(
  dir: URL,
  metas: Meta[],
  records: RunRecord[],
  cases: Map<string, GoldenCase>,
  extra: Record<string, unknown> = {},
) {
  const chat = records.filter((r): r is ChatRecord => r.kind === "chat");
  const nb = records.filter((r): r is NotebookRecord => r.kind === "notebook");
  const arms = [...new Set(chat.map((r) => r.arm))];
  const armSummaries = arms.map((arm) => summarizeArm(arm, chat, cases, modelCatalog));
  const notebookSummary = nb.length ? summarizeNotebook(nb, modelCatalog) : null;
  const judgeCaps = judgeOutputs(records);
  write(
    new URL("summary.json", dir),
    JSON.stringify(
      { metas, arms: armSummaries, notebook: notebookSummary, judgeCaps, ...extra },
      null,
      2,
    ),
  );
  write(new URL("results.md", dir), renderResults(metas, armSummaries, notebookSummary, judgeCaps));
  write(new URL("safety-review.md", dir), renderSafetyReview(metas[0] as Meta, chat, cases));
  for (const a of armSummaries) {
    say(
      `${a.arm.padEnd(14)} runs ${a.runs} · checks ${a.passAll.pass}/${a.passAll.total} · safety gate ${a.safetyGateAll.pass}/${a.safetyGateAll.total} · grounded ${a.groundedAccuracy.pass}/${a.groundedAccuracy.total} · judge ${a.judge.groundedness.pass}/${a.judge.groundedness.total}`,
    );
  }
  if (notebookSummary) {
    say(
      `notebook       verbatim ${notebookSummary.verbatim.pass}/${notebookSummary.verbatim.total} · classification ${notebookSummary.classification.pass}/${notebookSummary.classification.total}`,
    );
  }
}

it.skipIf(!enabled)(
  "pnpm eval",
  async () => {
    const args: string[] = JSON.parse(process.env.LUMI_EVAL_ARGS ?? "[]");
    const parsed = parseEvalArgs(args);
    if (!parsed.ok) throw new Error(parsed.error);
    const opts = parsed.options;
    const live = process.env.LUMI_LIVE === "1" && !opts.dryRun;

    const golden = readJsonl("./golden.jsonl", (v) => GoldenCaseSchema.parse(v));
    const notebookCases = readJsonl("./notebook.jsonl", (v) => NotebookCaseSchema.parse(v));
    const kbs = { en: await loadKnowledgeBase("en"), es: await loadKnowledgeBase("es") };
    const cases = new Map<string, GoldenCase>(golden.map((c) => [c.id, c]));

    if (opts.report) {
      // No calls: no provider is created on this path. It only reads what earlier runs wrote
      // and merges them (evals/lib/merge.ts), refusing runs that aren't comparable.
      const runs = opts.report.map((name) => {
        const runDir = new URL(`./runs/${name}/`, import.meta.url);
        const summary = JSON.parse(readFileSync(new URL("summary.json", runDir), "utf8"));
        return {
          name,
          metas: (summary.metas ?? [summary.meta]) as Meta[],
          records: readJsonl(`./runs/${name}/results.jsonl`, (v) => v as RunRecord),
        };
      });
      const merged = mergeRuns(runs, {
        fingerprint: fingerprint(kbs),
        judgePromptVersion: JUDGE_PROMPT_VERSION,
        judgeModel: config.models.judge,
        routerModel: config.models.router,
        notebookModel: config.models.notebook,
      });
      if (!merged.ok) throw new Error(`--report: ${merged.error}`);
      const stamp = `${new Date().toISOString().replace(/[:.]/g, "-")}-report`;
      const dir = new URL(`./runs/${stamp}/`, import.meta.url);
      mkdirSync(dir, { recursive: true });
      writeReport(dir, merged.metas, merged.records, cases);
      say(`\nReport (no model call): evals/runs/${stamp}/results.md, safety-review.md`);
      return;
    }

    const sizes = promptSizes(kbs);
    const fullPlan = buildPlan(opts, golden, notebookCases, modelCatalog);
    const fitted = fitPlanToBudget(fullPlan, sizes, modelCatalog, opts.budgetUsd);
    const { plan, estimate } = fitted;

    const printEstimate = (title: string, e: typeof estimate, units: number) => {
      say(`\n${title}: ${units} units, budget cap $${opts.budgetUsd.toFixed(2)}`);
      say("section                          units  calls   warm      cold      worst");
      for (const s of [...e.sections, { label: "TOTAL", units, estimate: e.total }]) {
        say(
          `${s.label.padEnd(32)} ${String(s.units).padStart(5)}  ${String(s.estimate.calls).padStart(5)}  ${usd(s.estimate.warm).padEnd(9)} ${usd(s.estimate.cold).padEnd(9)} ${usd(s.estimate.worst)}`,
        );
      }
    };
    if (fitted.droppedArms.length) {
      printEstimate(
        "Requested plan",
        estimatePlan(fullPlan, sizes, modelCatalog),
        fullPlan.units.length,
      );
    }
    printEstimate(fitted.droppedArms.length ? "Fitted plan" : "Plan", estimate, plan.units.length);
    const t = estimate.total;
    say(
      `(warm: the KB prefix cached at ${config.evals.estimate.warmCachedShare * 100}% after its first call; cold: nothing cached; worst: cold + every output cap. Output estimate per call: ${JSON.stringify(config.evals.estimate.outputTokens)}; ${config.evals.estimate.charsPerToken} chars/token.)`,
    );
    for (const s of plan.skippedArms) say(`skipped arm ${s.arm}: ${s.reason}`);
    for (const arm of fitted.droppedArms) {
      plan.skippedArms.push({
        arm,
        reason: "dropped before the run (priority order): the warm estimate didn't fit the cap",
      });
      say(`dropped arm ${arm} (priority order): the warm estimate didn't fit the cap`);
    }
    if (t.unknownPrice.length) say(`unknown prices: ${t.unknownPrice.join(", ")}`);

    if (!live) {
      say(
        opts.dryRun
          ? "\nDry run: no model was called."
          : "\nNo LUMI_LIVE=1: estimate only, no model was called.",
      );
      return;
    }
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set (.env.local)");
    if (!fitted.fits) {
      say(
        `\nABORTED before any call: the warm estimate ${usd(t.warm)} is above the cap $${opts.budgetUsd}. Narrow the run (--arms, --judge=first, --runs) or raise --budget.`,
      );
      return;
    }

    const started = new Date();
    const stamp = started.toISOString().replace(/[:.]/g, "-");
    const dir = new URL(`./runs/${stamp}/`, import.meta.url);
    mkdirSync(dir, { recursive: true });
    const resultsFile = new URL("results.jsonl", dir);
    const guard = createBudgetGuard(opts.budgetUsd);
    say(`\nLive run → evals/runs/${stamp}/\n`);

    const outcome = await executePlan(plan, {
      provider: createOpenAIProvider(),
      kbs,
      catalog: modelCatalog,
      guard,
      concurrency: opts.concurrency,
      onRecord: (r) => appendFileSync(resultsFile, redactSecrets(`${JSON.stringify(r)}\n`)),
      log: (line) => say(line),
    });

    const meta: Meta = {
      date: started.toISOString().slice(0, 10),
      gitSha: git("rev-parse HEAD"),
      dirty: git("status --porcelain") !== "",
      fingerprint: fingerprint(kbs),
      judgeModel: config.models.judge,
      routerModel: config.models.router,
      notebookModel: config.models.notebook,
      judgePromptVersion: JUDGE_PROMPT_VERSION,
      args,
      estimate,
      capUsd: opts.budgetUsd,
      spentUsd: guard.spentUsd,
      stoppedAt: guard.stoppedAt,
      skippedArms: plan.skippedArms,
      unavailableArms: outcome.unavailableArms.map((u) => ({
        arm: u.arm,
        reason: `the API rejected the model id (${u.error?.statusCode ?? "?"} ${u.error?.name ?? ""})`,
      })),
      skippedUnits: outcome.records.filter((r) => r.status !== "done").length,
      durationMin: (Date.now() - started.getTime()) / 60_000,
      runDir: `evals/runs/${stamp}/`,
    };
    writeReport(dir, [meta], outcome.records, cases, {
      guard: {
        spentUsd: guard.spentUsd,
        stoppedAt: guard.stoppedAt,
        overruns: guard.overruns,
        unknownCostCalls: guard.unknownCostCalls,
      },
      fatal: outcome.fatal,
    });
    say(
      `\nActual spend: ${usd(guard.spentUsd)} of $${opts.budgetUsd.toFixed(2)} (overruns ${guard.overruns}, unknown-cost calls ${guard.unknownCostCalls})`,
    );
    if (guard.stoppedAt) say(`Budget guard stopped before: ${guard.stoppedAt}`);
    if (outcome.fatal) say(`Stopped: ${outcome.fatal}`);
    say(`\nReport: evals/runs/${stamp}/results.md, safety-review.md, summary.json, results.jsonl`);
  },
  7_200_000,
);
