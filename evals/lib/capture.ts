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
  error: { name: string; statusCode: number | null; message: string } | null;
};

type WrappableModel = Exclude<LanguageModel, string>;

function describeError(error: unknown): Capture["error"] {
  const e = error as { name?: unknown; statusCode?: unknown; message?: unknown };
  return {
    name: typeof e?.name === "string" ? e.name : "Error",
    statusCode: typeof e?.statusCode === "number" ? e.statusCode : null,
    message: typeof e?.message === "string" ? e.message.slice(0, 300) : "",
  };
}

/** True when a provider error says the model id itself was rejected (skip that arm). */
export function isModelUnavailable(error: Capture["error"]): boolean {
  if (!error) return false;
  if (error.statusCode === 404) return true;
  return (
    (error.statusCode === 400 || error.statusCode === 403) &&
    /model/i.test(error.message) &&
    /(does not exist|not found|not supported|do not have access|unknown|invalid)/i.test(
      error.message,
    )
  );
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
          capture.error = describeError(error);
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
          capture.error = describeError(error);
          throw error;
        }
        const tee = new TransformStream<
          typeof result.stream extends ReadableStream<infer P> ? P : never,
          typeof result.stream extends ReadableStream<infer P> ? P : never
        >({
          transform(part, controller) {
            if (part.type === "text-delta") capture.text += part.delta;
            else if (part.type === "error") capture.error = describeError(part.error);
            controller.enqueue(part);
          },
        });
        return { ...result, stream: result.stream.pipeThrough(tee) };
      },
    },
  });
  return { model: wrapped, capture };
}
