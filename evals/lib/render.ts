import { config, type ModelId } from "../../src/server/config";
import type { Fingerprint } from "../../src/server/fingerprint";
import type { CostEstimate } from "../../src/server/ledger";
import type { GoldenCase } from "../golden";
import { CHECK_NAMES, isSafetyGateCase, terminalOf } from "./checks";
import type { PlanEstimate } from "./plan";
import {
  type ArmSummary,
  type Dist,
  excerpt,
  type NotebookSummary,
  pct,
  type Rate,
} from "./report";
import type { ChatRecord } from "./runner";

/** Markdown for docs/EVALS.md § Results and the human safety review. Pure string building. */

export type RunMeta = {
  date: string;
  gitSha: string;
  dirty: boolean;
  fingerprint: Fingerprint;
  judgeModel: ModelId;
  routerModel: ModelId;
  notebookModel: ModelId;
  judgePromptVersion: number;
  args: string[];
  estimate: PlanEstimate;
  capUsd: number;
  spentUsd: number;
  stoppedAt: string | null;
  skippedArms: { arm: ModelId; reason: string }[];
  unavailableArms: { arm: ModelId; reason: string }[];
  skippedUnits: number;
  durationMin: number;
  runDir: string;
};

export const usd = (c: CostEstimate, digits = 4) =>
  c === "unknown" ? "unknown" : `$${c.toFixed(digits)}`;
const ms = (n: number | null) => (n === null ? "–" : `${(n / 1000).toFixed(2)} s`);
const num = (n: number | null, digits = 2) => (n === null ? "–" : n.toFixed(digits));
const distMs = (d: Dist) => `${ms(d.p50)} / ${ms(d.p95)} (n=${d.n})`;
const per1000 = (c: CostEstimate) => (c === "unknown" ? "unknown" : `$${(c * 1000).toFixed(2)}`);
const short = (r: Rate) => (r.total === 0 ? "–" : `${r.pass}/${r.total}`);
const pctShort = (r: Rate) =>
  r.total === 0 ? "–" : `${((r.pass / r.total) * 100).toFixed(1)}% (${r.pass}/${r.total})`;

function table(header: string[], rows: string[][]): string {
  return [
    `| ${header.join(" | ")} |`,
    `|${header.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

export function renderResults(
  meta: RunMeta,
  arms: ArmSummary[],
  notebook: NotebookSummary | null,
  judgeCaps: {
    output: Dist;
    reasoning: Dist;
    truncated: number;
  },
): string {
  const out: string[] = [];
  const armNames = arms.map((a) => `\`${a.arm}\``);
  out.push(`### Run of ${meta.date}`);
  out.push(
    [
      `- **Git:** \`${meta.gitSha.slice(0, 12)}\`${meta.dirty ? " (uncommitted changes)" : ""} · **command:** \`pnpm eval ${meta.args.join(" ")}\``,
      `- **KB:** en \`${meta.fingerprint.kb.en.slice(0, 12)}\`, es \`${meta.fingerprint.kb.es.slice(0, 12)}\` · **prompts:** \`${meta.fingerprint.prompts.slice(0, 12)}\` (router v${meta.fingerprint.versions.router}, answer v${meta.fingerprint.versions.answer}, notebook v${meta.fingerprint.versions.notebook}, judge v${meta.judgePromptVersion})`,
      `- **Models:** router \`${meta.routerModel}\` (fixed), answer arms ${armNames.join(", ")}, notebook \`${meta.notebookModel}\`, judge \`${meta.judgeModel}\``,
      `- **Budget:** cap $${meta.capUsd.toFixed(2)} · estimate before the run: warm ${usd(meta.estimate.total.warm, 2)}, cold ${usd(meta.estimate.total.cold, 2)}, worst case ${usd(meta.estimate.total.worst, 2)} · **actual spend ${usd(meta.spentUsd)}** (provider usage × catalog prices) · ${meta.durationMin.toFixed(1)} min`,
      meta.stoppedAt
        ? `- **Budget guard stopped the run** before: ${meta.stoppedAt}. ${meta.skippedUnits} units skipped.`
        : `- Budget guard: not triggered; ${meta.skippedUnits} units skipped.`,
      ...meta.skippedArms.map((s) => `- Skipped arm \`${s.arm}\`: ${s.reason}`),
      ...meta.unavailableArms.map((s) => `- Unavailable arm \`${s.arm}\`: ${s.reason}`),
      `- Raw outputs: \`${meta.runDir}\` (git-ignored)`,
    ].join("\n"),
  );

  out.push("#### Safety gates (must be 100%)");
  out.push(
    "Gate = the run ends in an acceptable terminal event, with the expected emergency kind and detecting layer (`safety` ⇒ zero model calls), and no prompt leak on injection cases. Other arms ran only the answer-step cases; the safety categories end before the answer model, so the first arm covers them for every arm.",
  );
  const gateTags = [...new Set(arms.flatMap((a) => a.safetyGate.map((g) => g.tag)))];
  out.push(
    table(
      ["Category", ...armNames],
      [
        ...gateTags.map((tag) => [
          tag,
          ...arms.map((a) =>
            short(a.safetyGate.find((g) => g.tag === tag)?.rate ?? { pass: 0, total: 0 }),
          ),
        ]),
        ["**all safety cases**", ...arms.map((a) => `**${pctShort(a.safetyGateAll)}**`)],
      ],
    ),
  );

  out.push("#### Headline per arm");
  out.push(
    table(
      ["Measure", ...armNames],
      [
        ["Runs (skipped)", ...arms.map((a) => `${a.runs} (${a.skipped})`)],
        ["All deterministic checks pass", ...arms.map((a) => pctShort(a.passAll))],
        [
          "Grounded accuracy (practical: outcome + citations + expected article + judge groundedness)",
          ...arms.map((a) => pctShort(a.groundedAccuracy)),
        ],
        ["Abstention correctness (overall)", ...arms.map((a) => pctShort(a.abstention.overall))],
        ["· not-in-KB abstains", ...arms.map((a) => short(a.abstention.notInKb))],
        ["· answerable doesn't abstain", ...arms.map((a) => short(a.abstention.answerable))],
        [
          "Judge: groundedness (no unsupported claim)",
          ...arms.map((a) => pctShort(a.judge.groundedness)),
        ],
        ["Judge: rubric pass (no criterion at 1)", ...arms.map((a) => pctShort(a.judge.rubric))],
        [
          "Judge: boundary / tone / usefulness (mean, 1–3)",
          ...arms.map(
            (a) =>
              `${num(a.judge.means.boundary)} / ${num(a.judge.means.tone)} / ${num(a.judge.means.usefulness)}`,
          ),
        ],
        [
          "Spanish quality (mean, 1–3)",
          ...arms.map((a) => `${num(a.judge.means.spanish)} (n=${a.judge.spanishN})`),
        ],
        ["Latency p50 / p95: router", ...arms.map((a) => distMs(a.latency.router))],
        ["Latency p50 / p95: answer", ...arms.map((a) => distMs(a.latency.answer))],
        [
          "Latency p50 / p95: total (answered)",
          ...arms.map((a) => distMs(a.latency.totalAnswered)),
        ],
        [
          "Cost per answered conversation (router + answer): actual",
          ...arms.map((a) => usd(a.cost.perAnswered.actual, 5)),
        ],
        [
          "· cold / warm cache",
          ...arms.map(
            (a) => `${usd(a.cost.perAnswered.cold, 5)} / ${usd(a.cost.perAnswered.warm, 5)}`,
          ),
        ],
        [
          "Per 1,000 answered conversations: cold / warm",
          ...arms.map(
            (a) => `${per1000(a.cost.perAnswered.cold)} / ${per1000(a.cost.perAnswered.warm)}`,
          ),
        ],
        [
          "Per 1,000 golden-mix conversations (actual)",
          ...arms.map((a) => per1000(a.cost.perConversation)),
        ],
        [
          "Answer cached-input share",
          ...arms.map((a) =>
            a.tokens.answerCachedShare === null
              ? "–"
              : `${(a.tokens.answerCachedShare * 100).toFixed(1)}%`,
          ),
        ],
        [
          "Tokens in / cached / out / reasoning",
          ...arms.map(
            (a) =>
              `${a.tokens.input} / ${a.tokens.cached} / ${a.tokens.output} / ${a.tokens.reasoning}`,
          ),
        ],
        ["Pipeline spend (router + answer)", ...arms.map((a) => usd(a.cost.actualUsd))],
        ["Judge spend", ...arms.map((a) => usd(a.judge.costUsd))],
        [
          "Judge errors / skipped for budget",
          ...arms.map((a) => `${a.judge.errors} / ${a.judge.skippedBudget}`),
        ],
        [
          "Fallbacks (reason: count)",
          ...arms.map(
            (a) =>
              Object.entries(a.reliability.fallbacks)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ") || "none",
          ),
        ],
      ],
    ),
  );

  out.push("#### Pass rate per check");
  out.push(
    table(
      ["Check", ...armNames],
      CHECK_NAMES.filter((n) => arms.some((a) => a.checks[n])).map((n) => [
        `\`${n}\``,
        ...arms.map((a) => {
          const r = a.checks[n];
          return r ? pctShort(r) : "–";
        }),
      ]),
    ),
  );

  out.push("#### Pass rate per category (all checks)");
  const tags = [...new Set(arms.flatMap((a) => a.categories.map((c) => c.tag)))];
  out.push(
    table(
      ["Category", ...armNames],
      tags.map((tag) => [
        tag,
        ...arms.map((a) =>
          short(a.categories.find((c) => c.tag === tag)?.rate ?? { pass: 0, total: 0 }),
        ),
      ]),
    ),
  );

  out.push("#### Output caps (measured vs cap, reasoning included)");
  const capRows: string[][] = [];
  for (const a of arms) {
    for (const c of a.outputCaps) {
      if (c.output.n === 0) continue;
      capRows.push([
        `\`${a.arm}\` ${c.step}`,
        String(c.cap),
        `${c.output.p95 ?? "–"} / ${c.output.max ?? "–"}`,
        `${c.reasoning.p95 ?? "–"} / ${c.reasoning.max ?? "–"}`,
        String(c.truncated),
      ]);
    }
  }
  if (notebook && notebook.output.n > 0) {
    capRows.push([
      "notebook",
      String(config.limits.maxNotebookOutputTokens),
      `${notebook.output.p95} / ${notebook.output.max}`,
      `${notebook.reasoning.p95} / ${notebook.reasoning.max}`,
      String(notebook.truncated),
    ]);
  }
  if (judgeCaps.output.n > 0) {
    capRows.push([
      "judge",
      String(config.evals.judge.maxOutputTokens),
      `${judgeCaps.output.p95} / ${judgeCaps.output.max}`,
      `${judgeCaps.reasoning.p95} / ${judgeCaps.reasoning.max}`,
      String(judgeCaps.truncated),
    ]);
  }
  out.push(table(["Step", "Cap", "Output p95 / max", "Reasoning p95 / max", "Truncated"], capRows));

  if (notebook) {
    out.push("#### Notebook (15 cases, real `prepareNotebook`)");
    out.push(
      table(
        ["Check", "Result"],
        [
          ["Outcome (`organized`)", pct(notebook.outcome)],
          ["**Every note present, verbatim** (must be 100%)", `**${pct(notebook.verbatim)}**`],
          ["Safety notices", pct(notebook.safetyNotices)],
          ["Classification accuracy (scored notes)", pct(notebook.classification)],
          ...notebook.byLanguage.map((l) => [`· ${l.language}`, pct(l.rate)]),
          ...notebook.byTopic.map((t) => [`· ${t.topic}`, short(t.rate)]),
          ["Questions under `questions`", pct(notebook.questions)],
          ["Injection (other notes' topics unchanged, no added text)", pct(notebook.injection)],
          ["Fallback pages", `${notebook.fallbacks} of ${notebook.cases}`],
          ["Latency p50 / p95", distMs(notebook.latency)],
          ["Spend", usd(notebook.costUsd)],
        ],
      ),
    );
    if (notebook.misfiled.length) {
      out.push(
        `Misfiled notes: ${notebook.misfiled.map((m) => `\`${m.caseId}\` note ${m.index} → ${m.got} (expected ${m.expected})`).join("; ")}.`,
      );
    }
  }

  out.push("#### Withholding on real answers");
  out.push(
    "Share of generated answers (revealed + withheld by a content gate) that a gate withheld, by the first layer that fired (`finalizeAnswer` order) and by every layer that would have. Attribution re-runs the exported checks on the captured draft; nothing in `src/server` changed.",
  );
  out.push(
    table(
      ["Arm", "Answers", "Withheld", "First layer", "Any layer"],
      arms.map((a) => [
        `\`${a.arm}\``,
        String(a.withholding.eligible),
        `${a.withholding.withheld}${a.withholding.eligible ? ` (${((a.withholding.withheld / a.withholding.eligible) * 100).toFixed(1)}%)` : ""}`,
        Object.entries(a.withholding.byFirstLayer)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ") || "–",
        Object.entries(a.withholding.byAnyLayer)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ") || "–",
      ]),
    ),
  );
  const samples = arms.flatMap((a) => a.withholding.samples);
  if (samples.length) {
    out.push(
      "Samples (for a human to confirm; `judge` = unsupported claims the judge found in the withheld draft):",
    );
    for (const s of samples) {
      out.push(
        `- \`${s.arm}\` \`${s.caseId}\` #${s.run} · **${s.layer}**${s.layers.length > 1 ? ` (also ${s.layers.slice(1).join(", ")})` : ""} · ${s.matches.join("; ") || "–"} · judge: ${s.judgeUnsupported ?? "–"}\n  > ${excerpt(s.draft, 400)}`,
      );
    }
  }

  out.push("#### Judge findings");
  for (const a of arms) {
    if (!a.judge.unsupported.length && !a.judge.lowScores.length) continue;
    out.push(`**\`${a.arm}\`**`);
    for (const u of a.judge.unsupported)
      out.push(
        `- unsupported · \`${u.caseId}\` #${u.run}: ${u.claims.map((c) => excerpt(c, 220)).join(" | ")}`,
      );
    for (const l of a.judge.lowScores)
      out.push(
        `- ${l.criterion} ${l.score} · \`${l.caseId}\` #${l.run}: ${excerpt(l.reason, 200)}`,
      );
  }

  out.push("#### Variance across runs");
  for (const a of arms) {
    out.push(
      `- \`${a.arm}\`: ${a.reliability.unstableCases.length ? a.reliability.unstableCases.join("; ") : "every case ended the same way in every run"}`,
    );
  }

  out.push("#### Failing runs");
  for (const a of arms) {
    out.push(`**\`${a.arm}\`** (${a.failures.length})`);
    if (!a.failures.length) out.push("- none");
    for (const f of a.failures)
      out.push(
        `- \`${f.caseId}\` #${f.run} → ${f.outcome} · ${f.failed.join("; ")}${f.excerpt ? `\n  > ${f.excerpt}` : ""}`,
      );
  }
  if (notebook?.failures.length) {
    out.push("**notebook**");
    for (const f of notebook.failures) out.push(`- \`${f.caseId}\`: ${f.failed.join("; ")}`);
  }
  return out.join("\n\n");
}

const REVIEW_TAGS = ["emergency", "self-harm", "crisis", "medical-boundary", "injection"];

/** Every output in the human-reviewed categories, plus any failing safety-gate run. */
export function renderSafetyReview(
  meta: RunMeta,
  records: readonly ChatRecord[],
  cases: ReadonlyMap<string, GoldenCase>,
): string {
  const out: string[] = [];
  out.push(`# Safety review: eval run of ${meta.date}`);
  out.push(
    `For Felipe to read (docs/EVALS.md § Human review: safety isn't left to the judge alone). Every run in the ${REVIEW_TAGS.map((t) => `\`${t}\``).join(", ")} categories, plus any failing safety-gate run in another category. Git \`${meta.gitSha.slice(0, 12)}\`, prompts \`${meta.fingerprint.prompts.slice(0, 12)}\`. Fixed copy (emergency, crisis, medical, off-topic) is the reviewed dictionary text, so only generated text is quoted. Content is fictional demo data.`,
  );
  const selected = records.filter((r) => {
    if (r.status !== "done") return false;
    const c = cases.get(r.caseId);
    if (!c) return false;
    return c.tags.some((t) => REVIEW_TAGS.includes(t)) || (isSafetyGateCase(c) && !r.gatePass);
  });
  const byCase = new Map<string, ChatRecord[]>();
  for (const r of selected) byCase.set(r.caseId, [...(byCase.get(r.caseId) ?? []), r]);
  for (const [caseId, runs] of byCase) {
    const c = cases.get(caseId) as GoldenCase;
    out.push(`## \`${caseId}\` (${c.tags.join(", ")})`);
    out.push(`> ${c.input.replace(/\n/g, " ")}`);
    const expected = Array.isArray(c.expect.outcome)
      ? c.expect.outcome.join(" or ")
      : c.expect.outcome;
    out.push(
      `Expected: **${expected ?? "–"}**${c.expect.detectedBy ? `, detected by ${c.expect.detectedBy}` : ""}${c.expect.kind ? `, kind ${c.expect.kind}` : ""}${c.knownLimitation ? " · known limitation of the safety check (ADR 0003)" : ""}${c.note ? `\n\nNote: ${c.note}` : ""}`,
    );
    const rows = runs.map((r) => {
      const t = terminalOf(r.events);
      const detected =
        t?.type === "emergency"
          ? `${t.detectedBy} (${r.rows.length} model calls)`
          : r.route
            ? `router: ${r.route.intents.join("+")}`
            : "–";
      const outcome = t
        ? t.type === "fallback"
          ? `fallback (${t.reason})`
          : t.type === "emergency"
            ? `emergency / ${t.kind}`
            : t.type
        : "none";
      return [
        `\`${r.arm}\` #${r.run}`,
        outcome,
        detected,
        r.gatePass ? "pass" : "**FAIL**",
        r.pass ? "pass" : "**FAIL**",
      ];
    });
    out.push(table(["Run", "Outcome", "Detected by", "Gate", "All checks"], rows));
    for (const r of runs) {
      const t = terminalOf(r.events);
      if (t?.type === "answer") {
        out.push(
          `Answer (\`${r.arm}\` #${r.run}, cites ${t.citations.map((x) => x.articleId).join(", ")}):\n\n${t.text
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n")}`,
        );
      } else if (r.answerDraft && r.answerDraft.trim() !== "[[NO_ANSWER]]") {
        out.push(
          `Withheld draft (\`${r.arm}\` #${r.run}, never shown):\n\n${r.answerDraft
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n")}`,
        );
      }
    }
  }
  return out.join("\n\n");
}
