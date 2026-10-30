import { getServerDeps } from "@/server/app";
import { config } from "@/server/config";
import { readJsonBounded, requestContextFrom } from "@/server/http";
import { NotebookRequestShapeSchema, prepareNotebook } from "@/server/notebook";

/**
 * "Prepare for my appointment": the parent's on-device notes → a structured, printable page.
 * Stateless: the notes are processed for this request and never stored (ADR 0005).
 */
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  const body = await readJsonBounded(request, config.limits.notebook.maxRequestBytes);
  if (!body.ok) return Response.json({ error: "too_large" }, { status: 413 });
  const shape = NotebookRequestShapeSchema.safeParse(body.json);
  if (!shape.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  const ctx = requestContextFrom(request, deps.rateLimitSalt);
  const result = await prepareNotebook(shape.data, ctx, {
    model: deps.models.language(config.models.notebook),
    limiters: { notebook: deps.limiters.notebook, modelCalls: deps.limiters.modelCalls },
    ledger: deps.ledger,
    log: deps.log,
  });
  if (result.kind === "rejected") return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.response, { headers: { "Cache-Control": "no-store" } });
}
