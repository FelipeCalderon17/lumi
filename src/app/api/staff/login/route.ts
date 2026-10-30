import { z } from "zod";
import { getServerDeps } from "@/server/app";
import { config } from "@/server/config";
import {
  bodyErrorResponse,
  PRIVATE_NO_STORE,
  readJsonBounded,
  requestContextFrom,
  sessionCookie,
} from "@/server/http";
import { issueSessionToken, passcodeMatches } from "@/server/staff-auth";

const LoginSchema = z.object({ passcode: z.string().min(1).max(200) }).strict();

/** Staff login (ADR 0008): fail closed, throttled, constant-time, HMAC session cookie. */
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  const auth = deps.staffAuth;
  if (!auth.enabled) {
    return Response.json({ error: "staff_disabled" }, { status: 503, headers: PRIVATE_NO_STORE });
  }
  const ctx = requestContextFrom(request, deps.rateLimitSalt);
  if (!deps.limiters.staffLogin.check(ctx.rateLimitKey).allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: PRIVATE_NO_STORE });
  }
  const body = await readJsonBounded(request, config.limits.maxRequestBytes);
  if (!body.ok) return bodyErrorResponse(body.reason, PRIVATE_NO_STORE);
  const parsed = LoginSchema.safeParse(body.json);
  if (!parsed.success || !passcodeMatches(parsed.data.passcode, auth.passcode)) {
    deps.log({ requestId: ctx.requestId, event: "staff_login", outcome: "rejected" });
    return Response.json({ error: "unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE });
  }
  const token = issueSessionToken(auth.sessionSecret, Date.now(), config.staff.sessionTtlMs);
  deps.log({ requestId: ctx.requestId, event: "staff_login", outcome: "ok" });
  return Response.json(
    { status: "ok" },
    {
      headers: {
        ...PRIVATE_NO_STORE,
        "Set-Cookie": sessionCookie(config.staff.cookieName, token, config.staff.sessionTtlMs),
      },
    },
  );
}
