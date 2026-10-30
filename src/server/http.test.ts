import { describe, expect, it } from "vitest";
import { readBodyBounded } from "./http";

function streamOf(...parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

describe("http.readBodyBounded", () => {
  it("returns the text when it fits", async () => {
    await expect(readBodyBounded(streamOf('{"a":', "1}"), 100)).resolves.toEqual({
      ok: true,
      text: '{"a":1}',
    });
  });

  it("stops reading as soon as the limit is passed", async () => {
    await expect(readBodyBounded(streamOf("x".repeat(60), "x".repeat(60)), 100)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("counts bytes, not characters (multi-byte Spanish text)", async () => {
    // "ñ" is 2 bytes in UTF-8.
    await expect(readBodyBounded(streamOf("ñ".repeat(51)), 100)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
    await expect(readBodyBounded(streamOf("ñ".repeat(50)), 100)).resolves.toEqual({
      ok: true,
      text: "ñ".repeat(50),
    });
  });

  it("treats a missing body as empty", async () => {
    await expect(readBodyBounded(null, 100)).resolves.toEqual({ ok: true, text: "" });
  });
});
