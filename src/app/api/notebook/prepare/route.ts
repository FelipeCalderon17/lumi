import { getServerDeps } from "@/server/app";
import { config } from "@/server/config";
import { bodyErrorResponse, readJsonBounded, requestContextFrom } from "@/server/http";
import { prepareNotebook } from "@/server/notebook";

/** Notes are private: no shared cache may keep a response, error or not. */
const HEADERS = { "Cache-Control": "private, no-store" };

/**
 * "Prepare for my appointment": the parent's on-device notes, sorted by topic, verbatim.
 * Stateless: the notes are processed for this request and never stored (ADR 0005).
 * Every 400 has the same envelope, `{ error, safetyNotices }`; the server scans every note it
 * can recover for emergencies before validating anything else.
 */
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  const body = await readJsonBounded(request, config.limits.notebook.maxRequestBytes);
  if (!body.ok) return bodyErrorResponse(body.reason, HEADERS, { safetyNotices: [] });

  const ctx = requestContextFrom(request, deps.rateLimitSalt);
  const result = await prepareNotebook(body.json, ctx, {
    model: deps.models.language(config.models.notebook),
    limiters: { notebook: deps.limiters.notebook, modelCalls: deps.limiters.modelCalls },
    ledger: deps.ledger,
    log: deps.log,
  });
  if (result.kind === "rejected") {
    // Safety notices found before validation are never dropped, even on a 400.
    return Response.json(
      { error: result.error, safetyNotices: result.safetyNotices },
      { status: 400, headers: HEADERS },
    );
  }
  return Response.json(result.response, { headers: HEADERS });
}
