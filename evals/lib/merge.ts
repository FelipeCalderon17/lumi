import type { ModelId } from "../../src/server/config";
import type { Fingerprint } from "../../src/server/fingerprint";
import type { RunMeta } from "./render";
import type { RunRecord } from "./runner";

/**
 * `pnpm eval --report=<dirs>`: merges earlier runs into one report. Pure, and it makes no model
 * call (it only reads what the runs wrote). It refuses runs that aren't comparable: a different
 * KB, prompt hash, prompt version, judge prompt version or model role, and two finished records
 * for the same unit (the same case, arm and run, or the same notebook case).
 */
export type RunFiles = { name: string; metas: RunMeta[]; records: RunRecord[] };
export type CurrentInputs = {
  fingerprint: Fingerprint;
  judgePromptVersion: number;
  judgeModel: ModelId;
  routerModel: ModelId;
  notebookModel: ModelId;
};
export type Merged =
  | { ok: true; metas: RunMeta[]; records: RunRecord[] }
  | { ok: false; error: string };

export function unitKey(r: RunRecord): string {
  return r.kind === "chat" ? `chat|${r.arm}|${r.caseId}|${r.run}` : `notebook|${r.caseId}`;
}

function incompatibility(meta: RunMeta, current: CurrentInputs): string | null {
  const f = meta.fingerprint;
  const c = current.fingerprint;
  if (f.kb.en !== c.kb.en || f.kb.es !== c.kb.es) return "KB hash";
  if (f.prompts !== c.prompts) return "prompt hash";
  if (
    f.versions.router !== c.versions.router ||
    f.versions.answer !== c.versions.answer ||
    f.versions.notebook !== c.versions.notebook
  ) {
    return "prompt version";
  }
  if (meta.judgePromptVersion !== current.judgePromptVersion) return "judge prompt version";
  if (meta.judgeModel !== current.judgeModel) return "judge model";
  if (meta.routerModel !== current.routerModel) return "router model";
  if (meta.notebookModel !== current.notebookModel) return "notebook model";
  return null;
}

export function mergeRuns(runs: readonly RunFiles[], current: CurrentInputs): Merged {
  if (runs.length === 0) return { ok: false, error: "no runs to merge" };
  const names = new Set<string>();
  const metas: RunMeta[] = [];
  for (const run of runs) {
    if (names.has(run.name)) return { ok: false, error: `run ${run.name} listed twice` };
    names.add(run.name);
    for (const meta of run.metas) {
      const problem = incompatibility(meta, current);
      if (problem) return { ok: false, error: `run ${run.name}: different ${problem}` };
      metas.push(meta);
    }
  }
  const done = new Map<string, RunRecord>();
  const skipped = new Map<string, RunRecord>();
  for (const run of runs) {
    for (const r of run.records) {
      const key = unitKey(r);
      if (r.status !== "done") {
        if (!skipped.has(key)) skipped.set(key, r);
        continue;
      }
      if (done.has(key)) return { ok: false, error: `duplicate record ${key} (run ${run.name})` };
      done.set(key, r);
    }
  }
  // A unit skipped in one run and finished in another counts once, as finished.
  const records = [
    ...done.values(),
    ...[...skipped].filter(([k]) => !done.has(k)).map(([, r]) => r),
  ];
  return { ok: true, metas, records };
}
