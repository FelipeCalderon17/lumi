import { getServerDeps } from "@/server/app";
import { config } from "@/server/config";
import { PRIVATE_NO_STORE, readCookie } from "@/server/http";
import { staffOverview } from "@/server/staff";
import { checkStaffSession } from "@/server/staff-auth";

/** Staff list: consented gaps + usage with derived cost. Session checked on every request. */
export async function GET(request: Request): Promise<Response> {
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
  const overview = await staffOverview({ gaps: deps.gapStore, usage: deps.usageReader });
  return Response.json(overview, { headers: PRIVATE_NO_STORE });
}
