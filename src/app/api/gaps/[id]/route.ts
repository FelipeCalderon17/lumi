import { getServerDeps } from "@/server/app";
import { config } from "@/server/config";
import { deleteGapWithToken, GapDeleteSchema, GapIdSchema } from "@/server/gaps";
import { readJsonBounded } from "@/server/http";

/** Parent delete with the one-time token returned on save (ADR 0005). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/gaps/[id]">) {
  const deps = getServerDeps();
  const id = GapIdSchema.safeParse((await ctx.params).id);
  const body = await readJsonBounded(request, config.limits.maxRequestBytes);
  if (!body.ok) return Response.json({ error: "too_large" }, { status: 413 });
  const parsed = GapDeleteSchema.safeParse(body.json);
  if (!id.success || !parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const result = await deleteGapWithToken(id.data, parsed.data.deleteToken, deps.gapStore);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
