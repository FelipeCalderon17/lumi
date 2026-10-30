import type { LanguageModel } from "ai";
import { z } from "zod";
import { finalizeAnswer, generateAnswer } from "./answer";
import { config } from "./config";
import type { RequestContext } from "./context";
import { type ChatEvent, isTerminal, type TerminalEvent } from "./events";
import { type KnowledgeBase, MEDICAL_REDIRECT_ARTICLE_ID } from "./knowledge";
import { type LedgerOutcome, recordCallsBestEffort, type UsageLedger } from "./ledger";
import { type Logger, silentLogger } from "./log";
import type { RateLimiter } from "./rate-limit";
import { routeQuestion } from "./router";
import { checkEmergency } from "./safety";
import type { FailureReason, Language, ModelCall } from "./types";
import { LANGUAGES } from "./types";

export type { ChatEvent, Citation, ProgressEvent, TerminalEvent } from "./events";
export { encodeEvent, isTerminal, TERMINAL_EVENT_TYPES } from "./events";

/**
 * The chat pipeline, in order (see docs/ARCHITECTURE.md § Request flow):
 *
 *   body ≤ maxRequestBytes → JSON shape → SAFETY (no AI, never rate-limited) → length check
 *   → per-client rate limit → instance model-call ceiling → router → knowledge
 *   → answer (BUFFERED) → completion check → citation integrity → reveal → ledger (best-effort)
 *
 * Buffer → validate → reveal (ADR 0010): no model text reaches the parent until it has passed
 * every check. While it waits, the UI shows a calm `progress` state.
 *
 * Every request yields EXACTLY ONE terminal event, optionally preceded by `progress` events.
 */

/** Shape only. The length limit is checked AFTER the safety pre-check, so a long message that
 * describes an emergency still gets the emergency steps. */
export const ChatRequestShapeSchema = z.object({
  message: z.string(),
  /** The page's locale. Used for fixed messages when we cannot (or must not) ask a model. */
  locale: z.enum(LANGUAGES),
});
export type ChatRequestShape = z.infer<typeof ChatRequestShapeSchema>;

export const ChatRequestSchema = ChatRequestShapeSchema.extend({
  message: z.string().trim().min(1).max(config.limits.maxInputChars),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export type ChatDeps = {
  models: { router: LanguageModel; answer: LanguageModel };
  getKnowledgeBase: (language: Language) => Promise<KnowledgeBase>;
  ledger: UsageLedger;
  limiters: { chat: RateLimiter; modelCalls: RateLimiter };
  log?: Logger;
  /** Tests shorten deadlines; production uses config.timeouts. */
  timeouts?: Partial<Record<keyof typeof config.timeouts, number>>;
};

export type ChatStart =
  /** Message empty or over maxInputChars (after safety): HTTP 400, shown inline. */
  | { kind: "rejected"; error: "too_long" | "empty" }
  | { kind: "stream"; events: AsyncIterable<ChatEvent> };

/** The single key of the instance-wide model-call ceiling. */
export const INSTANCE_KEY = "instance";

/**
 * Entry point. Safety runs first, on the raw text of any length, before the length check and
 * before any limit. Only then is the request validated and the streamed pipeline started.
 */
export function startChat(shape: ChatRequestShape, ctx: RequestContext, deps: ChatDeps): ChatStart {
  const log = deps.log ?? silentLogger;
  const safety = checkEmergency(shape.message);
  if (safety.triggered) {
    log({ requestId: ctx.requestId, event: "safety", outcome: safety.kind, ruleId: safety.ruleId });
    const event: TerminalEvent = {
      type: "emergency",
      kind: safety.kind,
      detectedBy: "safety",
      language: safety.language,
    };
    return { kind: "stream", events: once(event) };
  }

  const parsed = ChatRequestSchema.safeParse(shape);
  if (!parsed.success) {
    return { kind: "rejected", error: shape.message.trim() === "" ? "empty" : "too_long" };
  }
  return {
    kind: "stream",
    events: exactlyOneTerminal(runPipeline(parsed.data, ctx, deps), shape.locale, ctx, log),
  };
}

async function* once(event: ChatEvent): AsyncGenerator<ChatEvent> {
  yield event;
}

type RecordedCall = { call: ModelCall; failureReason: FailureReason | null };

/**
 * Everything after the length check. Writes the ledger AFTER the terminal event has been
 * yielded (the route has already sent it and closed the stream), best-effort and time-bounded.
 */
export async function* runPipeline(
  request: ChatRequest,
  ctx: RequestContext,
  deps: ChatDeps,
): AsyncGenerator<ChatEvent> {
  const calls: RecordedCall[] = [];
  let outcome: LedgerOutcome = "fallback";
  try {
    for await (const event of steps(request, ctx, deps, calls)) {
      if (isTerminal(event)) {
        outcome = ctx.signal.aborted ? "cancelled" : event.type;
        (deps.log ?? silentLogger)({ requestId: ctx.requestId, event: "terminal", outcome });
      }
      yield event;
    }
  } finally {
    if (calls.length > 0) {
      await recordCallsBestEffort(
        deps.ledger,
        calls,
        { requestId: ctx.requestId, outcome },
        deps.timeouts?.ledgerWriteMs ?? config.timeouts.ledgerWriteMs,
      );
    }
  }
}

async function* steps(
  request: ChatRequest,
  ctx: RequestContext,
  deps: ChatDeps,
  calls: RecordedCall[],
): AsyncGenerator<ChatEvent> {
  const fallback = (reason: FailureReason, language: Language): TerminalEvent => ({
    type: "fallback",
    reason,
    language,
  });

  const client = deps.limiters.chat.check(ctx.rateLimitKey);
  if (!client.allowed) return yield fallback("rate_limited", request.locale);
  if (!deps.limiters.modelCalls.check(INSTANCE_KEY).allowed) {
    return yield fallback("capacity", request.locale);
  }

  yield { type: "progress", stage: "reading_guides" };

  const routed = await routeQuestion({ question: request.message }, ctx, {
    model: deps.models.router,
    timeoutMs: deps.timeouts?.routerMs,
  });
  if (routed.call) {
    calls.push({
      call: routed.call,
      failureReason: routed.result.ok ? null : routed.result.reason,
    });
  }
  if (!routed.result.ok) return yield fallback(routed.result.reason, request.locale);
  const route = routed.result.value;

  switch (route.category) {
    case "urgent":
      return yield {
        type: "emergency",
        kind: "medical_emergency",
        detectedBy: "router",
        language: route.language,
      };
    case "emotional_crisis":
      return yield { type: "crisis", language: route.language };
    case "off_topic":
      return yield { type: "off_topic", language: route.language };
    case "medical": {
      const kb = await deps.getKnowledgeBase(route.language);
      const article = kb.byId.get(MEDICAL_REDIRECT_ARTICLE_ID);
      if (!article) throw new Error(`missing ${MEDICAL_REDIRECT_ARTICLE_ID} in ${route.language}`);
      return yield {
        type: "medical",
        language: route.language,
        article: { handle: article.handle, articleId: article.id, title: article.title },
      };
    }
    case "practical":
      break;
  }

  if (!deps.limiters.modelCalls.check(INSTANCE_KEY).allowed) {
    return yield fallback("capacity", route.language);
  }
  const kb = await deps.getKnowledgeBase(route.language);
  const answered = await generateAnswer(
    { question: request.message, language: route.language, kb },
    ctx,
    {
      model: deps.models.answer,
      totalMs: deps.timeouts?.answerTotalMs,
      firstTokenMs: deps.timeouts?.answerFirstTokenMs,
    },
  );
  const draft = answered.result;
  if (!draft.ok) {
    if (answered.call) calls.push({ call: answered.call, failureReason: draft.reason });
    return yield fallback(draft.reason, route.language);
  }
  if (draft.value.kind === "abstained") {
    if (answered.call) calls.push({ call: answered.call, failureReason: null });
    return yield { type: "abstained", language: route.language, topic: route.topic };
  }
  const final = finalizeAnswer(draft.value.text, kb);
  if (answered.call) {
    calls.push({ call: answered.call, failureReason: final.ok ? null : final.reason });
  }
  if (!final.ok) return yield fallback(final.reason, route.language);
  return yield { type: "answer", language: route.language, ...final.value };
}

/**
 * Guarantees the transport contract whatever happens inside: progress events pass through,
 * the FIRST terminal event passes, anything after it is dropped, and a stage that throws or
 * ends without a terminal event becomes `fallback`. Keeps draining the inner generator after
 * the terminal event so its ledger write runs.
 */
export async function* exactlyOneTerminal(
  inner: AsyncIterable<ChatEvent>,
  language: Language,
  ctx: Pick<RequestContext, "requestId" | "signal">,
  log: Logger = silentLogger,
): AsyncGenerator<ChatEvent> {
  let terminal = false;
  const internal = (): TerminalEvent => ({
    type: "fallback",
    reason: ctx.signal.aborted ? "cancelled" : "internal",
    language,
  });
  try {
    for await (const event of inner) {
      if (terminal) {
        log({ requestId: ctx.requestId, event: "dropped_after_terminal", outcome: event.type });
        continue;
      }
      yield event;
      if (isTerminal(event)) terminal = true;
    }
  } catch (error) {
    log({
      requestId: ctx.requestId,
      event: "pipeline_error",
      reason: error instanceof Error ? error.name : "unknown",
    });
    if (!terminal) {
      terminal = true;
      yield internal();
    }
  }
  if (!terminal) yield internal();
}
