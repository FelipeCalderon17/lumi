/**
 * Test-only helpers: AI SDK mock models and a synthetic KB. Imported by *.test.ts files only,
 * never by app code. No network.
 */
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { RequestContext } from "./context";
import type { GapRecord, GapStore } from "./gaps";
import { type Article, buildKnowledgeBase, type KnowledgeBase } from "./knowledge";
import type { Language } from "./types";

/** The provider stream-part type, taken from the mock so we don't need @ai-sdk/provider. */
type LanguageModelV4StreamPart =
  Awaited<ReturnType<MockLanguageModelV4["doStream"]>>["stream"] extends ReadableStream<infer P>
    ? P
    : never;

export function usage(input = 1_000, cached = 0, output = 50, reasoning?: number) {
  return {
    inputTokens: {
      total: input,
      noCache: input - cached,
      cacheRead: cached,
      cacheWrite: undefined,
    },
    outputTokens: { total: output, text: output - (reasoning ?? 0), reasoning },
  };
}

type Finish = "stop" | "length" | "content-filter" | "error" | "other";

/** A streaming model that sends `chunks` as text deltas, then finishes. */
export function streamingModel(
  chunks: readonly string[],
  opts: { finish?: Finish; reasoning?: boolean; chunkDelayMs?: number } = {},
) {
  const parts: LanguageModelV4StreamPart[] = [
    ...(opts.reasoning
      ? ([
          { type: "reasoning-start", id: "r" },
          { type: "reasoning-end", id: "r" },
        ] as const)
      : []),
    { type: "text-start", id: "t" },
    ...chunks.map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
    { type: "text-end", id: "t" },
    {
      type: "finish",
      finishReason: { unified: opts.finish ?? "stop", raw: undefined },
      usage: usage(8_000, 6_000, 120, 40),
    },
  ];
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({ chunks: parts, chunkDelayInMs: opts.chunkDelayMs ?? null }),
    }),
  });
}

/** A model that returns `value` as JSON from doGenerate (structured output). */
export function jsonModel(value: unknown, finish: Finish = "stop") {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
      finishReason: { unified: finish, raw: undefined },
      usage: usage(400, 0, 30, 10),
      warnings: [],
    }),
  });
}

/** A model that never answers until aborted (stalled provider). */
export function hangingModel() {
  const never = (abortSignal: AbortSignal | undefined) =>
    new Promise<never>((_, reject) => {
      abortSignal?.addEventListener("abort", () => reject(abortSignal.reason), { once: true });
    });
  return new MockLanguageModelV4({
    doGenerate: ({ abortSignal }) => never(abortSignal),
    doStream: ({ abortSignal }) => never(abortSignal),
  });
}

/** A model whose stream starts, then stalls after `chunks` until aborted. */
export function stallingStreamModel(chunks: readonly string[]) {
  return new MockLanguageModelV4({
    doStream: async ({ abortSignal }) => ({
      stream: new ReadableStream<LanguageModelV4StreamPart>({
        start(controller) {
          controller.enqueue({ type: "text-start", id: "t" });
          for (const delta of chunks) controller.enqueue({ type: "text-delta", id: "t", delta });
          abortSignal?.addEventListener("abort", () => controller.error(abortSignal.reason), {
            once: true,
          });
        },
      }),
    }),
  });
}

/** A model whose provider call fails (5xx, network…). */
export function failingModel(message = "provider down") {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error(message);
    },
    doStream: async () => {
      throw new Error(message);
    },
  });
}

export function testArticles(language: Language, count = 12): Article[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `article-${String(i + 1).padStart(2, "0")}`,
    lang: language,
    title: `Article ${i + 1}`,
    category: "hospital-logistics" as const,
    risk: "standard" as const,
    reviewedAt: "2026-10-30",
    body: `Body of article ${i + 1}.`,
  }));
}

/** A KB that also contains the medical-template article, like the real one. */
export function testKb(language: Language = "en"): KnowledgeBase {
  return buildKnowledgeBase(language, [
    ...testArticles(language, 11),
    {
      id: "questions-for-your-care-team",
      lang: language,
      title: language === "en" ? "Questions for your care team" : "Preguntas para tu equipo",
      category: "talking-with-the-care-team",
      risk: "high",
      reviewedAt: "2026-10-30",
      body: "Write questions down.",
    },
  ]);
}

export function testCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: "00000000-0000-4000-8000-000000000001",
    rateLimitKey: "test",
    signal: new AbortController().signal,
    ...overrides,
  };
}

type StoredGap = GapRecord & { deleteTokenHash: string };

/** An in-memory GapStore with the same semantics as the Drizzle one. */
export function memoryGapStore(now: () => Date = () => new Date()) {
  const rows: StoredGap[] = [];
  const store: GapStore = {
    async insert(row) {
      const existing = rows.find((r) => r.id === row.id);
      if (existing) return existing.deleteTokenHash === row.deleteTokenHash ? "exists" : "conflict";
      rows.push({ ...row, createdAt: now() });
      return "inserted";
    },
    async listRecent(limit) {
      return [...rows]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
        .map(({ deleteTokenHash: _hash, ...record }) => record);
    },
    async delete(id) {
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1) return false;
      rows.splice(index, 1);
      return true;
    },
    async deleteWithTokenHash(id, hash) {
      const index = rows.findIndex((r) => r.id === id && r.deleteTokenHash === hash);
      if (index === -1) return false;
      rows.splice(index, 1);
      return true;
    },
    async purgeOlderThan(cutoff) {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) {
        if ((rows[i] as StoredGap).createdAt < cutoff) rows.splice(i, 1);
      }
      return before - rows.length;
    },
  };
  return { store, rows };
}
