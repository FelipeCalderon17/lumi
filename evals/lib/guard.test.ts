import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeAll, describe, expect, it } from "vitest";
import { config, modelCatalog } from "../../src/server/config";
import { type KnowledgeBase, loadKnowledgeBase } from "../../src/server/knowledge";
import type { ModelProvider } from "../../src/server/models";
import { usage } from "../../src/server/test-helpers";
import type { GoldenCase } from "../golden";
import { boundInputTokens, boundUsd, judgeBound } from "./bounds";
import { createBudgetGuard } from "./budget";
import { DEFAULT_OPTIONS } from "./options";
import { buildPlan } from "./plan";
import { executePlan } from "./runner";

/**
 * Regression for the Codex review (Phase 4 fixes round 1): the judge reservation used a fixed
 * answer length and the EXPECTED articles, then sent the real (longer) answer and the real
 * cited articles, so a run could pass its cap (repro: $2.00163399 against $2, overruns 1).
 * Here every mock bills close to the worst a request can: input from the ACTUAL prompt text at
 * the guard's own chars/token plus most of the overhead allowance, and the full output cap.
 * The guard must never let the spend pass the cap, and no call may cost more than it reserved.
 */

type Prompt = Parameters<MockLanguageModelV4["doGenerate"]>[0]["prompt"];

function promptChars(prompt: Prompt): number {
  let chars = 0;
  for (const message of prompt) {
    if (typeof message.content === "string") chars += message.content.length;
    else for (const part of message.content) if (part.type === "text") chars += part.text.length;
  }
  return chars;
}

/** Billed input: as close to the bound as possible without the schema (not in the prompt). */
const billedInput = (prompt: Prompt) =>
  boundInputTokens(promptChars(prompt)) - Math.floor(config.evals.guard.requestOverheadTokens / 10);

/** A long answer that cites three articles and passes every output check. */
const LONG_ANSWER = Array.from(
  { length: 40 },
  () =>
    "Pack comfortable clothes and a phone charger [2]. Write your questions down for the care team [6]. Keep papers in one place [1].",
).join(" ");

function adversarialModel() {
  return new MockLanguageModelV4({
    doGenerate: async ({ prompt, maxOutputTokens }) => {
      const all = JSON.stringify(prompt);
      const value = all.includes("You classify")
        ? { language: "en", intents: ["practical"], topic: "hospital-logistics" }
        : {
            unsupportedClaims: [],
            groundednessReason: "ok",
            boundary: { score: "3", reason: "ok" },
            tone: { score: "3", reason: "ok" },
            usefulness: { score: "3", reason: "ok" },
          };
      const output = maxOutputTokens ?? 0;
      return {
        content: [{ type: "text", text: JSON.stringify(value) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: usage(billedInput(prompt), 0, output, Math.floor(output / 2)),
        warnings: [],
      };
    },
    doStream: async ({ prompt, maxOutputTokens }) => {
      const output = maxOutputTokens ?? 0;
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: LONG_ANSWER },
            { type: "text-end", id: "t" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: undefined },
              usage: usage(billedInput(prompt), 0, output, Math.floor(output / 2)),
            },
          ] as never[],
        }),
      };
    },
  });
}

const provider: ModelProvider = {
  language: () => adversarialModel(),
  transcription: () => {
    throw new Error("no transcription in evals");
  },
};

const cases: GoldenCase[] = Array.from({ length: 4 }, (_, i) => ({
  id: `practical-en-00${i + 1}`,
  input: `What should I bring for the first night? (${i})`,
  locale: "en",
  expect: {
    outcome: "answer",
    category: "practical",
    language: "en",
    mustCite: true,
    // One short expected article: what the OLD judge reservation was sized on.
    articles: ["first-days-at-the-hospital"],
    judge: true,
  },
  tags: ["practical", "en"],
}));

let kbs: Record<"en" | "es", KnowledgeBase>;
beforeAll(async () => {
  kbs = { en: await loadKnowledgeBase("en"), es: await loadKnowledgeBase("es") };
});

describe("runtime budget guard: upper-bound reservations", () => {
  it("the judge bound covers the real request (long answer, three cited articles)", () => {
    const articles = [1, 2, 6].map((h) => {
      const a = kbs.en.byHandle.get(h);
      if (!a) throw new Error("missing article");
      return { handle: a.handle, title: a.title, body: a.body };
    });
    const input = {
      question: "q",
      answer: LONG_ANSWER,
      language: "en" as const,
      articles,
      mode: "rubric" as const,
    };
    const bound = judgeBound(input);
    // The old reservation assumed a 1,400-char answer; this request is several times larger.
    expect(bound.promptChars).toBeGreaterThan(LONG_ANSWER.length + 3 * 1_000);
    // attempts × (bounded input + full output cap), no cache discount.
    const once =
      (boundInputTokens(bound.promptChars) * 2 + config.evals.judge.maxOutputTokens * 10) / 1e6;
    expect(boundUsd(bound, modelCatalog)).toBeCloseTo(once * (config.retry.maxRetries + 1), 10);
  });

  it.each([0.02, 0.05, 0.1, 0.2, 0.5, 2])(
    "never spends past a $%s cap, and no call costs more than it reserved",
    async (cap) => {
      const plan = buildPlan(
        {
          ...DEFAULT_OPTIONS,
          arms: ["gpt-6-luna", "gpt-6-sol"],
          firstArmRuns: 2,
          notebook: false,
          allCasesAllArms: true,
        },
        cases,
        [],
        modelCatalog,
      );
      const guard = createBudgetGuard(cap);
      const outcome = await executePlan(plan, {
        provider,
        kbs,
        catalog: modelCatalog,
        guard,
        concurrency: 3,
      });
      expect(guard.overruns).toBe(0);
      expect(guard.spentUsd).toBeLessThanOrEqual(cap);
      expect(guard.reservedUsd).toBeCloseTo(0, 12);
      // The answers really were long and judged against the real cited articles.
      const judged = outcome.records.filter((r) => r.kind === "chat" && r.judge);
      if (cap >= 2) {
        expect(guard.stoppedAt).toBeNull();
        expect(judged.length).toBe(plan.units.length);
      }
    },
  );
});
