import { randomUUID } from "node:crypto";
import { config, type ModelId, type PriceCatalog } from "../../src/server/config";
import type { ChatEvent } from "../../src/server/events";
import type { KnowledgeBase } from "../../src/server/knowledge";
import {
  addCosts,
  type CostEstimate,
  estimateCost,
  type UsageEntry,
} from "../../src/server/ledger";
import type { ModelProvider } from "../../src/server/models";
import { type NotebookResponse, prepareNotebook } from "../../src/server/notebook";
import { type ChatDeps, startChat } from "../../src/server/pipeline";
import { createRateLimiter } from "../../src/server/rate-limit";
import { type Route, RouterOutputSchema, toRoute } from "../../src/server/router";
import { checkEmergency } from "../../src/server/safety";
import type { Language } from "../../src/server/types";
import {
  answerBound,
  boundUsd,
  type CallBound,
  judgeBound,
  notebookBound,
  routerBound,
} from "./bounds";
import type { BudgetGuard } from "./budget";
import { type Capture, captureModel, isModelUnavailable } from "./capture";
import { allPass, type CheckResult, gatePass, runChecks, terminalOf } from "./checks";
import { type JudgeInput, type JudgeMode, type JudgeResult, runJudge } from "./judge";
import { checkNotebookCase, type NotebookCheckResult } from "./notebook-checks";
import type { ChatUnit, NotebookUnit, Plan, Unit } from "./plan";
import { attributeWithholding, type Withholding } from "./withholding";

/**
 * Runs a plan through the REAL pipeline (`startChat`, `prepareNotebook`) with injected models:
 * the OpenAI provider for `pnpm eval`, AI SDK mocks in tests. Units run in plan (priority)
 * order with a small pool; each reserves its worst-case cost first, so the budget guard stops
 * the run cleanly before the cap and the rest is recorded as skipped.
 */

export type JudgeRecord = JudgeResult & {
  mode: JudgeMode;
  /** "answer": the revealed answer. "withheld_draft": a draft a gate withheld (FP hint). */
  target: "answer" | "withheld_draft";
};

export type SkipReason = "budget" | "model_unavailable" | "fatal";

export type ChatRecord = {
  kind: "chat";
  arm: ModelId;
  armIndex: number;
  run: number;
  caseId: string;
  tags: string[];
  locale: Language;
  input: string;
  status: "done" | { skipped: SkipReason };
  events: ChatEvent[];
  rejected: string | null;
  route: (Route & { intents: string[] }) | null;
  /** Raw answer text when it was NOT revealed (withheld or failed), for a human to read. */
  answerDraft: string | null;
  rows: UsageEntry[];
  latency: { routerMs: number | null; answerMs: number | null; totalMs: number };
  checks: CheckResult[];
  pass: boolean;
  gatePass: boolean;
  withholding: Withholding | null;
  judge: JudgeRecord | null;
  judgeSkipped: SkipReason | null;
  costUsd: CostEstimate;
  providerError: Capture["error"];
};

export type NotebookRecord = {
  kind: "notebook";
  caseId: string;
  status: "done" | { skipped: SkipReason };
  response: NotebookResponse | null;
  rows: UsageEntry[];
  latencyMs: number;
  check: NotebookCheckResult | null;
  costUsd: CostEstimate;
};

export type RunRecord = ChatRecord | NotebookRecord;

export type RunnerDeps = {
  provider: ModelProvider;
  kbs: Record<Language, KnowledgeBase>;
  catalog: PriceCatalog;
  guard: BudgetGuard;
  concurrency: number;
  /** Called once per finished unit (the live run appends it to results.jsonl). */
  onRecord?: (record: RunRecord) => void;
  log?: (line: string) => void;
};

export type RunOutcome = {
  records: RunRecord[];
  unavailableArms: { arm: ModelId; error: Capture["error"] }[];
  fatal: string | null;
};

const now = () => performance.now();

export function rowsCost(rows: readonly UsageEntry[], catalog: PriceCatalog): CostEstimate {
  return rows.reduce<CostEstimate>((sum, row) => addCosts(sum, estimateCost(row, catalog)), 0);
}

/** Reserves the upper bound of every call in `bounds` (bounds.ts), or returns null. */
function reserveBounds(
  guard: BudgetGuard,
  bounds: readonly CallBound[],
  catalog: PriceCatalog,
  label: string,
) {
  return guard.tryReserve(
    bounds.reduce((sum, b) => sum + boundUsd(b, catalog), 0),
    label,
  );
}

function limiter() {
  return createRateLimiter({ windowMs: 60_000, max: 1_000_000, maxKeys: 10 });
}

function ctx() {
  return { requestId: randomUUID(), rateLimitKey: "eval", signal: new AbortController().signal };
}

function parseRoute(capture: Capture): (Route & { intents: string[] }) | null {
  if (capture.calls === 0 || capture.text === "") return null;
  try {
    const parsed = RouterOutputSchema.safeParse(JSON.parse(capture.text));
    return parsed.success ? { ...toRoute(parsed.data), intents: parsed.data.intents } : null;
  } catch {
    return null;
  }
}

function skippedChat(unit: ChatUnit, reason: SkipReason): ChatRecord {
  return {
    kind: "chat",
    arm: unit.arm,
    armIndex: unit.armIndex,
    run: unit.run,
    caseId: unit.case.id,
    tags: unit.case.tags,
    locale: unit.case.locale,
    input: unit.case.input,
    status: { skipped: reason },
    events: [],
    rejected: null,
    route: null,
    answerDraft: null,
    rows: [],
    latency: { routerMs: null, answerMs: null, totalMs: 0 },
    checks: [],
    pass: false,
    gatePass: false,
    withholding: null,
    judge: null,
    judgeSkipped: null,
    costUsd: 0,
    providerError: null,
  };
}

export async function executePlan(plan: Plan, deps: RunnerDeps): Promise<RunOutcome> {
  const log = deps.log ?? (() => {});
  const records: RunRecord[] = new Array(plan.units.length);
  const unavailable = new Map<ModelId, Capture["error"]>();
  let fatal: string | null = null;
  let next = 0;
  let done = 0;

  const skipReason = (unit: Unit): SkipReason | null => {
    if (fatal) return "fatal";
    if (deps.guard.stoppedAt !== null) return "budget";
    if (unit.kind === "chat" && unavailable.has(unit.arm)) return "model_unavailable";
    return null;
  };

  const runChat = async (unit: ChatUnit): Promise<ChatRecord> => {
    const c = unit.case;
    const safetyOnly = checkEmergency(c.input).triggered;
    const label = `${unit.arm} ${c.id} run ${unit.run}`;
    // Upper bound of the router and answer calls, from the text that will actually be sent.
    const reservation = safetyOnly
      ? null
      : reserveBounds(
          deps.guard,
          [routerBound(c.input), answerBound(unit.arm, c.input, deps.kbs)],
          deps.catalog,
          label,
        );
    if (!safetyOnly && !reservation) return skippedChat(unit, "budget");

    const router = captureModel(deps.provider.language(config.models.router));
    const answer = captureModel(deps.provider.language(unit.arm));
    const rows: UsageEntry[] = [];
    const chatDeps: ChatDeps = {
      models: { router: router.model, answer: answer.model },
      getKnowledgeBase: async (language) => deps.kbs[language],
      // The pipeline labels answer rows with config.models.answer; the eval relabels them below.
      ledger: { record: async (entry) => void rows.push(entry) },
      limiters: { chat: limiter(), modelCalls: limiter() },
    };
    const started = now();
    const start = startChat({ message: c.input, locale: c.locale }, ctx(), chatDeps);
    const events: ChatEvent[] = [];
    if (start.kind === "stream") for await (const event of start.events) events.push(event);
    const totalMs = Math.round(now() - started);
    for (const row of rows) if (row.step === "answer") row.model = unit.arm;
    const costUsd = rowsCost(rows, deps.catalog);
    if (reservation) deps.guard.settle(reservation, costUsd);

    const providerError = answer.capture.error ?? router.capture.error;
    if (providerError?.statusCode === 401) fatal = "the provider rejected the API key (401)";
    if (isModelUnavailable(answer.capture.error) && !unavailable.has(unit.arm)) {
      unavailable.set(unit.arm, answer.capture.error);
      log(`! ${unit.arm} rejected by the API: skipping the rest of this arm`);
    }

    const route = parseRoute(router.capture);
    const terminal = terminalOf(events);
    const answerLanguage = route?.language ?? c.locale;
    const kb = deps.kbs[answerLanguage];
    const checks = runChecks(c, {
      events,
      rejected: start.kind === "rejected" ? start.error : null,
      modelCalls: rows.length,
      route,
      knownHandles: new Set(kb.byHandle.keys()),
    });
    const answerRow = rows.find((r) => r.step === "answer");
    // Only output-check fallbacks are withholdings; a timeout or provider error isn't.
    const withholding =
      terminal?.type === "fallback" &&
      (terminal.reason === "invalid_output" || terminal.reason === "truncated") &&
      answerRow &&
      answer.capture.calls > 0
        ? attributeWithholding(answer.capture.text, answerRow.finishReason, kb)
        : null;

    const record: ChatRecord = {
      ...skippedChat(unit, "budget"),
      status: "done",
      events,
      rejected: start.kind === "rejected" ? start.error : null,
      route,
      answerDraft: answerRow && terminal?.type !== "answer" ? answer.capture.text : null,
      rows,
      latency: {
        routerMs: rows.find((r) => r.step === "router")?.latencyMs ?? null,
        answerMs: answerRow?.latencyMs ?? null,
        totalMs,
      },
      checks,
      pass: allPass(checks),
      gatePass: gatePass(checks),
      withholding,
      costUsd,
      providerError,
    };

    // Judge: the revealed answer, or a draft withheld by a content gate (to tell FPs apart).
    const gateWithheld =
      withholding && ["dosage", "number_provenance", "phone_number"].includes(withholding.first);
    const target: JudgeRecord["target"] | null =
      terminal?.type === "answer" ? "answer" : gateWithheld ? "withheld_draft" : null;
    if (unit.judge !== "none" && target) {
      // Build the exact judge request first, then reserve its upper bound (Codex review).
      const text = terminal?.type === "answer" ? terminal.text : (record.answerDraft ?? "").trim();
      const handles =
        terminal?.type === "answer"
          ? terminal.citations.map((x) => x.handle)
          : (withholding?.citedHandles ?? []);
      const articles = handles.flatMap((h) => {
        const a = kb.byHandle.get(h);
        return a ? [{ handle: a.handle, title: a.title, body: a.body }] : [];
      });
      const mode: JudgeMode = target === "answer" ? unit.judge : "groundedness";
      const input: JudgeInput = {
        question: c.input,
        answer: text,
        language: answerLanguage,
        articles,
        mode,
      };
      const judgeReservation = reserveBounds(
        deps.guard,
        [judgeBound(input)],
        deps.catalog,
        `${label} judge`,
      );
      if (!judgeReservation) {
        record.judgeSkipped = "budget";
      } else {
        const result = await runJudge(input, {
          model: deps.provider.language(config.models.judge),
        });
        deps.guard.settle(judgeReservation, estimateCost(result.call, deps.catalog));
        record.judge = { ...result, mode, target };
      }
    }
    return record;
  };

  const runNotebook = async (unit: NotebookUnit): Promise<NotebookRecord> => {
    const reservation = reserveBounds(
      deps.guard,
      [notebookBound(unit.case.notes, unit.case.locale)],
      deps.catalog,
      `notebook ${unit.case.id}`,
    );
    const empty: NotebookRecord = {
      kind: "notebook",
      caseId: unit.case.id,
      status: { skipped: "budget" },
      response: null,
      rows: [],
      latencyMs: 0,
      check: null,
      costUsd: 0,
    };
    if (!reservation) return empty;
    const rows: UsageEntry[] = [];
    const started = now();
    const out = await prepareNotebook({ notes: unit.case.notes, locale: unit.case.locale }, ctx(), {
      model: deps.provider.language(config.models.notebook),
      limiters: { notebook: limiter(), modelCalls: limiter() },
      ledger: { record: async (entry) => void rows.push(entry) },
    });
    if (out.kind === "done") await out.recorded;
    const latencyMs = Math.round(now() - started);
    const costUsd = rowsCost(rows, deps.catalog);
    deps.guard.settle(reservation, costUsd);
    const response = out.kind === "done" ? out.response : null;
    return {
      ...empty,
      status: "done",
      response,
      rows,
      latencyMs,
      check: response ? checkNotebookCase(unit.case, response) : null,
      costUsd,
    };
  };

  const worker = async () => {
    while (next < plan.units.length) {
      const index = next++;
      const unit = plan.units[index] as Unit;
      const skip = skipReason(unit);
      let record: RunRecord;
      if (skip) {
        record =
          unit.kind === "chat"
            ? skippedChat(unit, skip)
            : {
                kind: "notebook",
                caseId: unit.case.id,
                status: { skipped: skip },
                response: null,
                rows: [],
                latencyMs: 0,
                check: null,
                costUsd: 0,
              };
      } else {
        record = unit.kind === "chat" ? await runChat(unit) : await runNotebook(unit);
      }
      records[index] = record;
      done += 1;
      deps.onRecord?.(record);
      if (record.status === "done") {
        const name =
          record.kind === "chat" ? `${record.arm} ${record.caseId} #${record.run}` : record.caseId;
        const verdict =
          record.kind === "chat"
            ? `${terminalOf(record.events)?.type ?? record.rejected}${record.pass ? "" : " FAIL"}`
            : `${record.response?.result.kind ?? "rejected"}${record.check?.checks.every((x) => x.pass) ? "" : " FAIL"}`;
        log(
          `[${done}/${plan.units.length}] ${name} → ${verdict}  spent $${deps.guard.spentUsd.toFixed(4)}`,
        );
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, deps.concurrency) }, worker));
  return {
    records,
    unavailableArms: [...unavailable.entries()].map(([arm, error]) => ({ arm, error })),
    fatal,
  };
}
