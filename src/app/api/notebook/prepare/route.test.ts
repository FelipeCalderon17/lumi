import { describe, expect, it, vi } from "vitest";
import { jsonModel } from "@/server/test-helpers";

const allow = { check: () => ({ allowed: true }) };
vi.mock("@/server/app", () => ({
  getServerDeps: () => ({
    models: {
      language: () =>
        jsonModel({ assignments: [{ index: 0, topic: "energy_activity", isQuestion: false }] }),
    },
    ledger: { record: async () => {} },
    limiters: { notebook: allow, modelCalls: allow },
    rateLimitSalt: "test-salt",
    log: () => {},
  }),
}));

const { POST } = await import("./route");

const post = (body: string) =>
  POST(
    new Request("http://localhost/api/notebook/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
  );
const notice = { kind: "medical_emergency", detectedBy: "safety", language: "es", noteIndex: 0 };

describe("POST /api/notebook/prepare: every 400 has one envelope (Codex re-review 3)", () => {
  it("emergency note + createdAt null → 400 { error, safetyNotices }, private no-store", async () => {
    const response = await post(
      JSON.stringify({ notes: [{ text: "No está respirando", createdAt: null }], locale: "es" }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "invalid_request", safetyNotices: [notice] });
  });

  it("emergency note + invalid locale → 400 { error, safetyNotices }, private no-store", async () => {
    const response = await post(
      JSON.stringify({
        notes: [{ text: "No está respirando", createdAt: "2026-10-27T23:10:00-05:00" }],
        locale: "fr",
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "invalid_request", safetyNotices: [notice] });
  });

  it("bad createdAt, bad shape and invalid JSON all use the same envelope and headers", async () => {
    for (const [body, error, safetyNotices] of [
      [
        JSON.stringify({ notes: [{ text: "No está respirando", createdAt: "x" }], locale: "es" }),
        "invalid_notes",
        [notice],
      ],
      [JSON.stringify({ notes: "nope", locale: "es" }), "invalid_request", []],
      ["{not json", "invalid_request", []],
    ] as const) {
      const response = await post(body);
      expect([body, response.status]).toEqual([body, 400]);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ error, safetyNotices });
    }
  });

  it("an oversized body → 413 with the same envelope and headers", async () => {
    const response = await post("x".repeat(1_000_000));
    expect(response.status).toBe(413);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "too_large", safetyNotices: [] });
  });

  it("a valid request is private, no-store too, and returns the notes verbatim by topic", async () => {
    const response = await post(
      JSON.stringify({
        notes: [{ text: "Tired", createdAt: "2026-10-27T23:10:00-05:00" }],
        locale: "es",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      safetyNotices: [],
      result: {
        kind: "organized",
        groups: [
          {
            topic: "energy_activity",
            notes: [{ index: 0, text: "Tired", createdAt: "2026-10-27T23:10:00-05:00" }],
          },
        ],
      },
    });
  });
});
