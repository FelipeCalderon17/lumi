import { config } from "@/server/config";
import { PRIVATE_NO_STORE, sessionCookie } from "@/server/http";

/** Clears the staff session cookie. */
export async function POST(): Promise<Response> {
  return Response.json(
    { status: "ok" },
    {
      headers: { ...PRIVATE_NO_STORE, "Set-Cookie": sessionCookie(config.staff.cookieName, "", 0) },
    },
  );
}
