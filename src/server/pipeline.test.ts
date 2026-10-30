import type { LanguageModel } from "ai";
import { describe, expect, it } from "vitest";
import { config } from "./config";
import { type ChatEvent, isTerminal } from "./events";
import type { UsageEntry, UsageLedger } from "./ledger";
import {
  type ChatDeps,
  ChatRequestSchema,
  ChatRequestShapeSchema,
  type ChatStart,
  encodeEvent,
  exactlyOneTerminal,
  startChat,
} from "./pipeline";
import { createRateLimiter } from "./rate-limit";
import {
  failingModel,
  hangingModel,
  jsonModel,
  stallingStreamModel,
  streamingModel,
  testCtx,
  testKb,
} from "./test-helpers";

describe("pipeline.ChatRequestSchema (contract)", () => {
  it("accepts a normal question", () => {
    expect(
      ChatRequestSchema.safeParse({ message: "Where can I park?", locale: "en" }).success,
    ).toBe(true);
  });

  it("rejects messages above the configured limit before any model call", () => {
    const tooLong = "a".repeat(config.limits.maxInputChars + 1);
    expect(ChatRequestSchema.safeParse({ message: tooLong, locale: "es" }).success).toBe(false);
  });

  it("the shape check alone accepts a long message, so safety can still run on it", () => {
    const tooLong = "he is not breathing ".repeat(100);
    expect(ChatRequestShapeSchema.safeParse({ message: tooLong, locale: "en" }).success).toBe(true);
  });
});

describe("pipeline transport (contract)", () => {
  it("frames each event as one JSON line", () => {
    const line = encodeEvent({ type: "progress", stage: "reading_guides" });
    expect(line.endsWith("\n")).toBe(true);
    expect(line.slice(0, -1)).not.toContain("\n");
    expect(JSON.parse(line)).toEqual({ type: "progress", stage: "reading_guides" });
  });

  it("escapes newlines inside answer text so framing survives", () => {
    const event: ChatEvent = { type: "answer", language: "en", text: "a\nb [1]", citations: [] };
    expect(encodeEvent(event).split("\n")).toHaveLength(2);
  });

  it("progress is the only non-terminal event", () => {
    expect(isTerminal({ type: "progress", stage: "reading_guides" })).toBe(false);
    expect(isTerminal({ type: "fallback", reason: "timeout", language: "es" })).toBe(true);
    expect(isTerminal({ type: "crisis", language: "en" })).toBe(true);
  });
});

// ── runPipeline via startChat, with mocked models ──────────────────────────────────────────

const route = (intents: string[], language = "en", topic = "hospital-logistics") =>
  jsonModel({ language, intents, topic });

function setup(
  opts: {
    router?: LanguageModel;
    answer?: LanguageModel;
    ledger?: UsageLedger;
    chatMax?: number;
    modelCallsMax?: number;
    getKnowledgeBase?: ChatDeps["getKnowledgeBase"];
  } = {},
) {
  const rows: UsageEntry[] = [];
  const router = opts.router ?? route(["practical"]);
  const answer = opts.answer ?? streamingModel(["Bring a charger [1]. ", "Ask your team [12]."]);
  const deps: ChatDeps = {
    models: { router, answer },
    getKnowledgeBase: opts.getKnowledgeBase ?? (async (language) => testKb(language)),
    ledger: opts.ledger ?? { record: async (entry) => void rows.push(entry) },
    limiters: {
      chat: createRateLimiter({ windowMs: 60_000, max: opts.chatMax ?? 10, maxKeys: 10 }),
      modelCalls: createRateLimiter({
        windowMs: 60_000,
        max: opts.modelCallsMax ?? 10,
        maxKeys: 1,
      }),
    },
    timeouts: { routerMs: 50, answerFirstTokenMs: 50, answerTotalMs: 200, ledgerWriteMs: 50 },
  };
  return { deps, rows, router, answer };
}

async function collect(start: ChatStart): Promise<ChatEvent[]> {
  if (start.kind !== "stream") throw new Error(`rejected: ${start.error}`);
  const events: ChatEvent[] = [];
  for await (const event of start.events) events.push(event);
  return events;
}

const ask = (message: string, locale: "en" | "es" = "en") => ({ message, locale });
const calls = (model: LanguageModel) => {
  const mock = model as unknown as { doGenerateCalls: unknown[]; doStreamCalls: unknown[] };
  return mock.doGenerateCalls.length + mock.doStreamCalls.length;
};
const terminals = (events: ChatEvent[]) => events.filter(isTerminal);
const last = (events: ChatEvent[]) => events[events.length - 1];

describe("pipeline.startChat (safety and limits)", () => {
  it("safety runs before the rate limiter: an emergency is answered even when rate-limited", async () => {
    const { deps, router } = setup({ chatMax: 0, modelCallsMax: 0 });
    const events = await collect(startChat(ask("he's not breathing"), testCtx(), deps));
    expect(events).toEqual([
      { type: "emergency", kind: "medical_emergency", detectedBy: "safety", language: "en" },
    ]);
    expect(calls(router)).toBe(0);
  });

  it("safety runs on an over-length message before the length check", async () => {
    const { deps } = setup();
    const long = `${"a".repeat(config.limits.maxInputChars * 3)} me voy a quitar la vida`;
    const events = await collect(startChat(ask(long, "en"), testCtx(), deps));
    expect(events).toEqual([
      { type: "emergency", kind: "self_harm", detectedBy: "safety", language: "es" },
    ]);
  });

  it("an over-length or empty message is rejected (HTTP 400) without a model call", () => {
    const { deps, router } = setup();
    const long = "a".repeat(config.limits.maxInputChars + 1);
    expect(startChat(ask(long), testCtx(), deps)).toEqual({ kind: "rejected", error: "too_long" });
    expect(startChat(ask("   "), testCtx(), deps)).toEqual({ kind: "rejected", error: "empty" });
    expect(calls(router)).toBe(0);
  });

  it("per-client rate limit → fallback(rate_limited) without a model call", async () => {
    const { deps, router } = setup({ chatMax: 0 });
    const events = await collect(startChat(ask("Where do I park?", "es"), testCtx(), deps));
    expect(events).toEqual([{ type: "fallback", reason: "rate_limited", language: "es" }]);
    expect(calls(router)).toBe(0);
  });

  it("instance model-call ceiling reached → fallback(capacity) without a model call", async () => {
    const { deps, router } = setup({ modelCallsMax: 0 });
    const events = await collect(startChat(ask("Where do I park?"), testCtx(), deps));
    expect(events).toEqual([{ type: "fallback", reason: "capacity", language: "en" }]);
    expect(calls(router)).toBe(0);
  });

  it("ceiling reached between router and answer → fallback(capacity), no answer call", async () => {
    const { deps, answer } = setup({ modelCallsMax: 1 });
    const events = await collect(startChat(ask("Where do I park?"), testCtx(), deps));
    expect(last(events)).toEqual({ type: "fallback", reason: "capacity", language: "en" });
    expect(calls(answer)).toBe(0);
  });
});

describe("pipeline.runPipeline (routing and answers)", () => {
  it("practical: progress, then one validated answer with citations, then the ledger", async () => {
    const { deps, rows } = setup();
    const events = await collect(startChat(ask("What should I pack?"), testCtx(), deps));
    expect(events).toEqual([
      { type: "progress", stage: "reading_guides" },
      {
        type: "answer",
        language: "en",
        text: "Bring a charger [1]. Ask your team [12].",
        citations: [
          { handle: 1, articleId: "article-01", title: "Article 1" },
          {
            handle: 12,
            articleId: "questions-for-your-care-team",
            title: "Questions for your care team",
          },
        ],
      },
    ]);
    expect(rows.map((r) => [r.step, r.outcome, r.failureReason])).toEqual([
      ["router", "answer", null],
      ["answer", "answer", null],
    ]);
    expect(rows[1]).toMatchObject({ inputTokens: 8_000, cachedInputTokens: 6_000 });
    expect(rows.every((r) => r.requestId === testCtx().requestId)).toBe(true);
  });

  it("answers in the router's language, not the page locale", async () => {
    const { deps } = setup({ router: route(["practical"], "es") });
    const events = await collect(startChat(ask("¿Qué llevo?", "en"), testCtx(), deps));
    expect(last(events)).toMatchObject({ type: "answer", language: "es" });
  });

  it("router 'urgent' → emergency(detectedBy: router) with no answer call", async () => {
    const { deps, answer } = setup({ router: route(["practical", "urgent"]) });
    const events = await collect(startChat(ask("she's gone limp"), testCtx(), deps));
    expect(last(events)).toEqual({
      type: "emergency",
      kind: "medical_emergency",
      detectedBy: "router",
      language: "en",
    });
    expect(calls(answer)).toBe(0);
  });

  it("router 'medical' → fixed medical template linking the care-team article, no answer call", async () => {
    const { deps, answer, rows } = setup({ router: route(["practical", "medical"], "es") });
    const events = await collect(startChat(ask("¿Le doy ibuprofeno?", "es"), testCtx(), deps));
    expect(last(events)).toEqual({
      type: "medical",
      language: "es",
      article: {
        handle: 12,
        articleId: "questions-for-your-care-team",
        title: "Preguntas para tu equipo",
      },
    });
    expect(calls(answer)).toBe(0);
    expect(rows.map((r) => [r.step, r.outcome])).toEqual([["router", "medical"]]);
  });

  it("crisis beats medical; off_topic gets the fixed redirect", async () => {
    const crisis = setup({ router: route(["medical", "emotional_crisis"]) });
    expect(last(await collect(startChat(ask("I can't go on"), testCtx(), crisis.deps)))).toEqual({
      type: "crisis",
      language: "en",
    });
    const offTopic = setup({ router: route(["off_topic"]) });
    expect(last(await collect(startChat(ask("a poem"), testCtx(), offTopic.deps)))).toEqual({
      type: "off_topic",
      language: "en",
    });
  });

  it("abstain marker (even split across chunks) → abstained with the router's topic", async () => {
    const { deps } = setup({
      router: route(["practical"], "en", "family-and-school"),
      answer: streamingModel(["[[NO_", "ANSWER]]"]),
    });
    const events = await collect(startChat(ask("Can our dog visit?"), testCtx(), deps));
    expect(last(events)).toEqual({ type: "abstained", language: "en", topic: "family-and-school" });
  });

  it("never yields model text before citation integrity passes (buffer → validate → reveal)", async () => {
    const secret = "UNVALIDATED-TEXT";
    const { deps, rows } = setup({ answer: streamingModel([`${secret} see [99].`]) });
    const events = await collect(startChat(ask("What should I pack?"), testCtx(), deps));
    expect(last(events)).toEqual({ type: "fallback", reason: "invalid_output", language: "en" });
    expect(JSON.stringify(events)).not.toContain(secret);
    expect(rows[1]).toMatchObject({ step: "answer", failureReason: "invalid_output" });
  });

  it("answer finishReason 'length' → fallback(truncated), text withheld", async () => {
    const { deps, rows } = setup({
      answer: streamingModel(["Bring a charger [1] and"], { finish: "length" }),
    });
    const events = await collect(startChat(ask("What should I pack?"), testCtx(), deps));
    expect(last(events)).toEqual({ type: "fallback", reason: "truncated", language: "en" });
    expect(JSON.stringify(events)).not.toContain("charger");
    expect(rows[1]).toMatchObject({ finishReason: "length", failureReason: "truncated" });
  });

  it("an answer with a dosage is withheld even with valid citations", async () => {
    const { deps } = setup({ answer: streamingModel(["Give 5 ml before bed [1]."]) });
    const events = await collect(startChat(ask("What should I pack?"), testCtx(), deps));
    expect(last(events)).toMatchObject({ type: "fallback", reason: "invalid_output" });
  });
});

describe("pipeline.runPipeline (failures)", () => {
  it("provider error (mocked) → fallback(provider_error), ledger row with finishReason none", async () => {
    const { deps, rows } = setup({ router: failingModel() });
    const events = await collect(startChat(ask("Where do I park?"), testCtx(), deps));
    expect(last(events)).toEqual({ type: "fallback", reason: "provider_error", language: "en" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      step: "router",
      finishReason: "none",
      failureReason: "provider_error",
      outcome: "fallback",
      inputTokens: null,
    });
  });

  it("router timeout (mocked) → fallback(timeout)", async () => {
    const { deps } = setup({ router: hangingModel() });
    const events = await collect(startChat(ask("Where do I park?"), testCtx(), deps));
    expect(last(events)).toEqual({ type: "fallback", reason: "timeout", language: "en" });
  });

  it("answer stalls → fallback(timeout) in the router's language", async () => {
    const { deps } = setup({ router: route(["practical"], "es"), answer: hangingModel() });
    const events = await collect(startChat(ask("¿Dónde estaciono?", "en"), testCtx(), deps));
    expect(last(events)).toEqual({ type: "fallback", reason: "timeout", language: "es" });
  });

  it("database down (ledger throws or hangs) → response unaffected and not delayed", async () => {
    for (const ledger of [
      { record: async () => Promise.reject(new Error("ECONNREFUSED")) },
      { record: () => new Promise<void>(() => {}) },
    ]) {
      const { deps } = setup({ ledger });
      const start = startChat(ask("What should I pack?"), testCtx(), deps);
      if (start.kind !== "stream") throw new Error("expected a stream");
      const started = Date.now();
      let terminalAt = 0;
      for await (const event of start.events) {
        if (isTerminal(event)) {
          terminalAt = Date.now() - started;
          expect(event.type).toBe("answer");
        }
      }
      const drainedAt = Date.now() - started;
      expect(terminalAt).toBeLessThan(40);
      // The hanging write is abandoned at ledgerWriteMs (50 ms in these tests).
      expect(drainedAt).toBeLessThan(500);
    }
  });

  it("client disconnect (request signal aborted) → model call aborted, ledger outcome cancelled", async () => {
    const request = new AbortController();
    const { deps, rows } = setup({ answer: stallingStreamModel(["Bring"]) });
    deps.timeouts = { ...deps.timeouts, answerFirstTokenMs: 5_000, answerTotalMs: 5_000 };
    setTimeout(() => request.abort(), 20);
    const events = await collect(
      startChat(ask("What should I pack?"), testCtx({ signal: request.signal }), deps),
    );
    expect(last(events)).toEqual({ type: "fallback", reason: "cancelled", language: "en" });
    expect(rows.map((r) => [r.step, r.outcome, r.failureReason])).toEqual([
      ["router", "cancelled", null],
      ["answer", "cancelled", "cancelled"],
    ]);
  });

  it("the KB failing to load → fallback(internal), never a thrown error", async () => {
    const { deps } = setup({
      getKnowledgeBase: async () => {
        throw new Error("EACCES");
      },
    });
    const events = await collect(startChat(ask("What should I pack?"), testCtx(), deps));
    expect(last(events)).toEqual({ type: "fallback", reason: "internal", language: "en" });
  });

  it("yields exactly one terminal event for every path, optionally after progress events", async () => {
    const scenarios: [string, Parameters<typeof setup>[0]][] = [
      ["practical", {}],
      ["urgent", { router: route(["urgent"]) }],
      ["crisis", { router: route(["emotional_crisis"]) }],
      ["medical", { router: route(["medical"]) }],
      ["off_topic", { router: route(["off_topic"]) }],
      ["abstained", { answer: streamingModel(["[[NO_ANSWER]]"]) }],
      ["router error", { router: failingModel() }],
      ["router invalid", { router: jsonModel("nope") }],
      ["answer error", { answer: failingModel() }],
      ["answer truncated", { answer: streamingModel(["x [1]"], { finish: "length" }) }],
      ["rate limited", { chatMax: 0 }],
      ["capacity", { modelCallsMax: 0 }],
    ];
    for (const [name, opts] of scenarios) {
      const { deps } = setup(opts);
      const events = await collect(startChat(ask("What should I pack?"), testCtx(), deps));
      expect([name, terminals(events).length]).toEqual([name, 1]);
      expect([name, isTerminal(last(events) as ChatEvent)]).toEqual([name, true]);
      expect(events.slice(0, -1).every((e) => e.type === "progress")).toBe(true);
    }
  });
});

describe("pipeline.exactlyOneTerminal", () => {
  const ctx = testCtx();
  async function* events(...list: ChatEvent[]) {
    for (const event of list) yield event;
  }
  const gather = async (iterable: AsyncIterable<ChatEvent>) => {
    const out: ChatEvent[] = [];
    for await (const event of iterable) out.push(event);
    return out;
  };

  it("drops anything after the first terminal event", async () => {
    const out = await gather(
      exactlyOneTerminal(
        events({ type: "crisis", language: "en" }, { type: "off_topic", language: "en" }),
        "en",
        ctx,
      ),
    );
    expect(out).toEqual([{ type: "crisis", language: "en" }]);
  });

  it("turns a stage that ends without a terminal event into a fallback", async () => {
    const out = await gather(
      exactlyOneTerminal(events({ type: "progress", stage: "reading_guides" }), "es", ctx),
    );
    expect(last(out)).toEqual({ type: "fallback", reason: "internal", language: "es" });
  });

  it("turns a thrown error into a fallback", async () => {
    async function* broken(): AsyncGenerator<ChatEvent> {
      yield { type: "progress", stage: "reading_guides" };
      throw new Error("bug");
    }
    const out = await gather(exactlyOneTerminal(broken(), "en", ctx));
    expect(out).toEqual([
      { type: "progress", stage: "reading_guides" },
      { type: "fallback", reason: "internal", language: "en" },
    ]);
  });
});
