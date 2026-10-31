import { getServerDeps } from "@/server/app";
import { config } from "@/server/config";
import { deleteGapWithToken, GapDeleteSchema, GapIdSchema } from "@/server/gaps";
import { bodyErrorResponse, readJsonBounded, requestContextFrom } from "@/server/http";

/**
 * Parent delete with the one-time token returned on save (ADR 0005). Rate-limited because a
 * delete of an id that isn't stored yet writes a tombstone.
 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/gaps/[id]">) {
  const deps = getServerDeps();
  const id = GapIdSchema.safeParse((await ctx.params).id);
  const body = await readJsonBounded(request, config.limits.maxRequestBytes);
  if (!body.ok) return bodyErrorResponse(body.reason);
  const parsed = GapDeleteSchema.safeParse(body.json);
  if (!id.success || !parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const client = requestContextFrom(request, deps.rateLimitSalt);
  if (!deps.limiters.gapDeletes.check(client.rateLimitKey).allowed) {
    return Response.json({ status: "rate_limited" }, { headers: { "Cache-Control": "no-store" } });
  }
  const result = await deleteGapWithToken(id.data, parsed.data.deleteToken, deps.gapStore);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
