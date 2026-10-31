import { config, MODEL_IDS, type ModelId } from "../../src/server/config";

/**
 * `pnpm eval` flags (passed through `LUMI_EVAL_ARGS` by evals/run.ts). Pure, so it's tested.
 *
 *   --dry-run              estimate only, no model calls
 *   --arms=a,b             answer models to run (default: config.evals.answerModels)
 *   --cases=<regex>        only cases whose id matches
 *   --limit=<n>            at most n cases (after the filter), for a tiny validation run
 *   --runs=<n>             runs per case for the FIRST arm (default: config.evals.runsPerCase)
 *   --judge=all|first|none judge every run, only run 1 of each case, or nothing
 *   --budget=<usd>         budget cap (default: config.evals.budgetCapUsd)
 *   --no-notebook          skip the notebook eval
 *   --all-cases            run every case in every arm (default: other arms get answer-step cases)
 *   --concurrency=<n>      calls in flight (default: config.evals.concurrency)
 *   --report=<dir>[,<dir>] no calls: re-aggregate earlier runs (evals/runs/<dir>) into one report
 */
export type EvalOptions = {
  dryRun: boolean;
  arms: ModelId[];
  casePattern: RegExp | null;
  limit: number | null;
  firstArmRuns: number;
  judge: "all" | "first" | "none";
  budgetUsd: number;
  notebook: boolean;
  allCasesAllArms: boolean;
  concurrency: number;
  /** Run directories (under evals/runs/) to merge into one report, without any call. */
  report: string[] | null;
};

export const DEFAULT_OPTIONS: EvalOptions = {
  dryRun: false,
  arms: [...config.evals.answerModels],
  casePattern: null,
  limit: null,
  firstArmRuns: config.evals.runsPerCase["gpt-6-luna"],
  judge: "all",
  budgetUsd: config.evals.budgetCapUsd,
  notebook: true,
  allCasesAllArms: false,
  concurrency: config.evals.concurrency,
  report: null,
};

export type ParsedOptions = { ok: true; options: EvalOptions } | { ok: false; error: string };

function positiveInt(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function parseEvalArgs(argv: readonly string[]): ParsedOptions {
  const options: EvalOptions = { ...DEFAULT_OPTIONS, arms: [...DEFAULT_OPTIONS.arms] };
  for (const arg of argv) {
    const [flag, value = ""] = arg.split(/=(.*)/s, 2) as [string, string | undefined];
    switch (flag) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--no-notebook":
        options.notebook = false;
        break;
      case "--all-cases":
        options.allCasesAllArms = true;
        break;
      case "--arms": {
        const arms = value.split(",").filter(Boolean);
        const unknown = arms.filter((a) => !(MODEL_IDS as string[]).includes(a));
        if (arms.length === 0 || unknown.length > 0) {
          return { ok: false, error: `--arms: unknown model ${unknown.join(",") || "(empty)"}` };
        }
        options.arms = arms as ModelId[];
        break;
      }
      case "--cases":
        try {
          options.casePattern = new RegExp(value);
        } catch {
          return { ok: false, error: "--cases: not a valid regular expression" };
        }
        break;
      case "--limit":
      case "--runs":
      case "--concurrency": {
        const n = positiveInt(value);
        if (n === null) return { ok: false, error: `${flag}: expected a positive integer` };
        if (flag === "--limit") options.limit = n;
        else if (flag === "--runs") options.firstArmRuns = n;
        else options.concurrency = n;
        break;
      }
      case "--judge":
        if (value !== "all" && value !== "first" && value !== "none") {
          return { ok: false, error: "--judge: expected all, first or none" };
        }
        options.judge = value;
        break;
      case "--budget": {
        const usd = Number(value);
        if (!Number.isFinite(usd) || usd <= 0) {
          return { ok: false, error: "--budget: expected a positive number of USD" };
        }
        options.budgetUsd = usd;
        break;
      }
      case "--report": {
        const dirs = value.split(",").filter(Boolean);
        if (dirs.length === 0 || dirs.some((d) => !/^[\w.-]+$/.test(d))) {
          return { ok: false, error: "--report: expected run directory names under evals/runs/" };
        }
        options.report = dirs;
        break;
      }
      default:
        return { ok: false, error: `unknown flag ${arg}` };
    }
  }
  return { ok: true, options };
}
