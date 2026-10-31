/**
 * `pnpm eval [flags]`: launcher for evals/eval.live.ts (docs/EVALS.md). Costs money when live,
 * never runs in CI.
 *
 *   pnpm eval --dry-run              plan + cost estimate, no model call (no key needed)
 *   LUMI_LIVE=1 pnpm eval [flags]    the paid run; flags in evals/lib/options.ts
 *
 * The package script loads OPENAI_API_KEY with Node's --env-file-if-exists=.env.local; this
 * file never reads or prints it. Only Node built-ins here, so Node runs it directly.
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
if (!dryRun && process.env.LUMI_LIVE !== "1") {
  console.log("pnpm eval: LUMI_LIVE=1 is not set, so this is an estimate only (no model call).");
  console.log(
    "Run `LUMI_LIVE=1 pnpm eval` for the paid run, or `pnpm eval --dry-run` to silence this.",
  );
}

const result = spawnSync(
  process.execPath,
  [
    "./node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "vitest.live.config.ts",
    "evals/eval.live.ts",
    "--silent=false",
    "--reporter=dot",
    "--testTimeout=7200000",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, LUMI_EVAL: "1", LUMI_EVAL_ARGS: JSON.stringify(args) },
  },
);
process.exit(result.status ?? 1);
