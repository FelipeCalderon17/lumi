import { describe, expect, it, vi } from "vitest";
import { signOutStaff } from "./staff-session";

const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("signOutStaff", () => {
  it("signed out only when the server confirms", async () => {
    const fetcher = respond(200, { status: "ok" });
    expect(await signOutStaff(fetcher)).toBe("signed_out");
    expect(fetcher).toHaveBeenCalledWith("/api/staff/logout", {
      method: "POST",
      cache: "no-store",
    });
  });

  it("a server error, an unexpected body or no network → failed (the dashboard stays)", async () => {
    expect(await signOutStaff(respond(500, { error: "internal" }))).toBe("failed");
    expect(await signOutStaff(respond(200, { status: "nope" }))).toBe("failed");
    const html = vi.fn(async () => new Response("<html>", { status: 200 }));
    expect(await signOutStaff(html as unknown as typeof fetch)).toBe("failed");
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await signOutStaff(offline as unknown as typeof fetch)).toBe("failed");
  });
});
