/**
 * Staff sign-out (ADR 0008). The session cookie is httpOnly, so only the server can clear it:
 * the page may show the sign-in screen ONLY after the server confirms. Anything else (network
 * error, 5xx, an unexpected body) is "failed", and the dashboard stays with a retry.
 */
export type SignOutResult = "signed_out" | "failed";

export async function signOutStaff(fetcher: typeof fetch = fetch): Promise<SignOutResult> {
  try {
    const response = await fetcher("/api/staff/logout", { method: "POST", cache: "no-store" });
    if (!response.ok) return "failed";
    const body = (await response.json().catch(() => null)) as { status?: unknown } | null;
    return body?.status === "ok" ? "signed_out" : "failed";
  } catch {
    return "failed";
  }
}
