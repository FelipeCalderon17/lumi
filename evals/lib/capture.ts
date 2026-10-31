import { type LanguageModel, wrapLanguageModel } from "ai";

/**
 * Eval-only model wrapper: records the raw text a model returned (the router's JSON, the
 * answer's draft, also when the pipeline withholds it) and any provider error, without
 * changing what the pipeline receives. One wrapper per request, so concurrent runs don't mix.
 * Raw text goes only to git-ignored run files (evals/runs/).
 */
export type Capture = {
  text: string;
  /** Provider calls made through this wrapper (a retry counts twice). */
  calls: number;
  /**
   * A provider error, reduced to what's safe to keep: never the message, body or headers,
   * which can echo credentials or the request (Codex review, Phase 4 fixes round 1).
   */
  error: ProviderErrorSummary | null;
};

export const PROVIDER_ERROR_KINDS = [
  "model_unavailable",
  "auth",
  "rate_limited",
  "timeout",
  "provider_error",
] as const;
export type ProviderErrorKind = (typeof PROVIDER_ERROR_KINDS)[number];
export type ProviderErrorSummary = {
  /** The error class name, only if it looks like an identifier (e.g. "AI_APICallError"). */
  name: string;
  statusCode: number | null;
  kind: ProviderErrorKind;
};

type WrappableModel = Exclude<LanguageModel, string>;

const MODEL_REJECTED =
  /(does not exist|not found|not supported|do not have access|unknown|invalid)/i;

/**
 * Classifies a provider error. The message is read here, in memory, only to tell a rejected
 * model id apart; it's never returned, stored or printed.
 */
export function classifyProviderError(error: unknown): ProviderErrorSummary {
  const e = error as { name?: unknown; statusCode?: unknown; message?: unknown };
  const rawName = typeof e?.name === "string" ? e.name : "";
  const name = /^[A-Za-z_][\w.]{0,59}$/.test(rawName) ? rawName : "Error";
  const statusCode = typeof e?.statusCode === "number" ? e.statusCode : null;
  const message = typeof e?.message === "string" ? e.message : "";
  const namesModel = /model/i.test(message) && MODEL_REJECTED.test(message);
  const kind: ProviderErrorKind =
    statusCode === 404 || ((statusCode === 400 || statusCode === 403) && namesModel)
      ? "model_unavailable"
      : statusCode === 401 || statusCode === 403
        ? "auth"
        : statusCode === 429
          ? "rate_limited"
          : name === "AbortError" || name === "TimeoutError"
            ? "timeout"
            : "provider_error";
  return { name, statusCode, kind };
}

/** True when a provider error says the model id itself was rejected (skip that arm). */
export function isModelUnavailable(error: Capture["error"]): boolean {
  return error?.kind === "model_unavailable";
}

export function captureModel(model: LanguageModel): { model: LanguageModel; capture: Capture } {
  if (typeof model === "string") throw new Error("captureModel needs a model instance");
  const capture: Capture = { text: "", calls: 0, error: null };
  const wrapped = wrapLanguageModel({
    model: model as WrappableModel,
    middleware: {
      wrapGenerate: async ({ doGenerate }) => {
        capture.calls += 1;
        try {
          const result = await doGenerate();
          capture.text = result.content
            .flatMap((part) => (part.type === "text" ? [part.text] : []))
            .join("");
          return result;
        } catch (error) {
          capture.error = classifyProviderError(error);
          throw error;
        }
      },
      wrapStream: async ({ doStream }) => {
        capture.calls += 1;
        capture.text = "";
        let result: Awaited<ReturnType<typeof doStream>>;
        try {
          result = await doStream();
        } catch (error) {
          capture.error = classifyProviderError(error);
          throw error;
        }
        const tee = new TransformStream<
          typeof result.stream extends ReadableStream<infer P> ? P : never,
          typeof result.stream extends ReadableStream<infer P> ? P : never
        >({
          transform(part, controller) {
            if (part.type === "text-delta") capture.text += part.delta;
            else if (part.type === "error") capture.error = classifyProviderError(part.error);
            controller.enqueue(part);
          },
        });
        return { ...result, stream: result.stream.pipeThrough(tee) };
      },
    },
  });
  return { model: wrapped, capture };
}
