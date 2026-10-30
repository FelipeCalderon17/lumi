import { getServerDeps } from "@/server/app";
import { config } from "@/server/config";
import { GapSubmissionSchema, saveGap } from "@/server/gaps";
import { readJsonBounded, requestContextFrom } from "@/server/http";

/**
 * Save a consented gap (ADR 0005). Thin: bounded read → validate → rate limit → save.
 * Every outcome is 200 with a `status` the UI turns into fixed copy; only transport problems
 * are non-2xx. `unavailable` = no database in this demo.
 */
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  const body = await readJsonBounded(request, config.limits.maxRequestBytes);
  if (!body.ok) return Response.json({ error: "too_large" }, { status: 413 });
  const parsed = GapSubmissionSchema.safeParse(body.json);
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  const ctx = requestContextFrom(request, deps.rateLimitSalt);
  if (!deps.limiters.gaps.check(ctx.rateLimitKey).allowed) {
    return Response.json({ status: "rate_limited" }, { headers: { "Cache-Control": "no-store" } });
  }
  const result = await saveGap(parsed.data, deps.gapStore);
  deps.log({ requestId: ctx.requestId, event: "gap_save", outcome: result.status });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
