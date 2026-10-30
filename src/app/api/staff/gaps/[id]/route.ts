import { getServerDeps } from "@/server/app";
import { config } from "@/server/config";
import { withTimeout } from "@/server/context";
import { GapIdSchema } from "@/server/gaps";
import { PRIVATE_NO_STORE, readCookie } from "@/server/http";
import { checkStaffSession } from "@/server/staff-auth";

/** Staff delete of any gap. Session checked on every request. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/staff/gaps/[id]">) {
  const deps = getServerDeps();
  const session = checkStaffSession(
    deps.staffAuth,
    readCookie(request.headers.get("cookie"), config.staff.cookieName),
  );
  if (!session.ok) {
    return Response.json(
      { error: session.error },
      { status: session.status, headers: PRIVATE_NO_STORE },
    );
  }
  const id = GapIdSchema.safeParse((await ctx.params).id);
  if (!id.success)
    return Response.json({ error: "invalid_request" }, { status: 400, headers: PRIVATE_NO_STORE });
  if (!deps.gapStore)
    return Response.json({ status: "unavailable" }, { headers: PRIVATE_NO_STORE });
  const deleted = await withTimeout(deps.gapStore.delete(id.data), config.timeouts.dbMs).then(
    (found) => (found ? "deleted" : "not_found"),
    () => "failed",
  );
  return Response.json({ status: deleted }, { headers: PRIVATE_NO_STORE });
}
