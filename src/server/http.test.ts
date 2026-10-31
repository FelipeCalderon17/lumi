import { describe, expect, it } from "vitest";
import type { ChatEvent } from "./events";
import {
  bodyErrorResponse,
  ndjsonStream,
  readBodyBounded,
  readBytesBounded,
  readCookie,
  readJsonBounded,
  requestContextFrom,
  sessionCookie,
} from "./http";

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

describe("http.readBytesBounded", () => {
  it("returns the exact bytes when they fit", async () => {
    const read = await readBytesBounded(streamOf("ab", "c"), 10);
    expect(read.ok && new TextDecoder().decode(read.bytes)).toBe("abc");
  });
});

/** A body that sends `first`, then never sends more or closes. `cancel()` may never settle. */
function stalledStream(first: string, opts: { hangingCancel?: boolean } = {}) {
  let cancelCalled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(first));
    },
    cancel() {
      cancelCalled = true;
      return opts.hangingCancel ? new Promise<void>(() => {}) : undefined;
    },
  });
  return { stream, cancelled: () => cancelCalled };
}

const elapsed = async <T>(work: Promise<T>) => {
  const started = performance.now();
  const value = await work;
  return { value, ms: performance.now() - started };
};

describe("http.readBytesBounded (bounded in time, Codex review 3)", () => {
  it("a stalled stream → timeout at the read deadline, and the stream is cancelled", async () => {
    const { stream, cancelled } = stalledStream("{");
    const { value, ms } = await elapsed(readBytesBounded(stream, 100, { deadlineMs: 30 }));
    expect(value).toEqual({ ok: false, reason: "timeout" });
    expect(ms).toBeLessThan(500);
    expect(cancelled()).toBe(true);
  });

  it("the request signal aborting → aborted, without waiting for the deadline", async () => {
    const { stream } = stalledStream("{");
    const client = new AbortController();
    setTimeout(() => client.abort(), 10);
    const { value, ms } = await elapsed(
      readBytesBounded(stream, 100, { signal: client.signal, deadlineMs: 10_000 }),
    );
    expect(value).toEqual({ ok: false, reason: "aborted" });
    expect(ms).toBeLessThan(500);
  });

  it("an already-aborted signal → aborted", async () => {
    expect(
      await readBytesBounded(stalledStream("{").stream, 100, { signal: AbortSignal.abort() }),
    ).toEqual({ ok: false, reason: "aborted" });
  });

  it("regression (Codex re-review 3): pre-aborted + buffered or closed body → aborted, not ok", async () => {
    const buffered = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    expect(await readBytesBounded(buffered, 10, { signal: AbortSignal.abort() })).toEqual({
      ok: false,
      reason: "aborted",
    });
    const closed = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    expect(await readBytesBounded(closed, 10, { signal: AbortSignal.abort() })).toEqual({
      ok: false,
      reason: "aborted",
    });
    expect(await readBytesBounded(null, 10, { signal: AbortSignal.abort() })).toEqual({
      ok: false,
      reason: "aborted",
    });
    expect(await readBodyBounded(streamOf("{}"), 10, { signal: AbortSignal.abort() })).toEqual({
      ok: false,
      reason: "aborted",
    });
  });

  it("regression (Codex re-review 3): an abort mid-read rejects even if the rest is already buffered", async () => {
    const client = new AbortController();
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array([pulls]));
        if (pulls === 1) client.abort(); // the client leaves while chunks keep arriving
        if (pulls === 3) controller.close();
      },
    });
    expect(await readBytesBounded(stream, 10, { signal: client.signal })).toEqual({
      ok: false,
      reason: "aborted",
    });
  });

  it("pre-aborted with a cancel() that never settles still returns within cancelWaitMs", async () => {
    const { stream } = stalledStream("{", { hangingCancel: true });
    const { value, ms } = await elapsed(
      readBytesBounded(stream, 100, { signal: AbortSignal.abort(), cancelWaitMs: 20 }),
    );
    expect(value).toEqual({ ok: false, reason: "aborted" });
    expect(ms).toBeLessThan(500);
  });

  it("an errored stream → stream_error", async () => {
    const errored = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{"));
        setTimeout(() => controller.error(new Error("socket reset")), 5);
      },
    });
    expect(await readBytesBounded(errored, 100)).toEqual({ ok: false, reason: "stream_error" });
    const locked = streamOf("x");
    locked.getReader();
    expect(await readBytesBounded(locked, 100)).toEqual({ ok: false, reason: "stream_error" });
  });

  it("oversized body whose cancel() never settles → too_large, after at most cancelWaitMs", async () => {
    const { stream, cancelled } = stalledStream("x".repeat(200), { hangingCancel: true });
    const { value, ms } = await elapsed(readBytesBounded(stream, 100, { cancelWaitMs: 20 }));
    expect(value).toEqual({ ok: false, reason: "too_large" });
    expect(cancelled()).toBe(true);
    expect(ms).toBeLessThan(500);
  });

  it("stalled body whose cancel() never settles still returns", async () => {
    const { stream } = stalledStream("{", { hangingCancel: true });
    const { value, ms } = await elapsed(
      readBytesBounded(stream, 100, { deadlineMs: 20, cancelWaitMs: 20 }),
    );
    expect(value).toEqual({ ok: false, reason: "timeout" });
    expect(ms).toBeLessThan(500);
  });

  it("readJsonBounded uses the request's own signal", async () => {
    const client = new AbortController();
    const request = new Request("http://x/api/chat", {
      method: "POST",
      body: stalledStream("{").stream,
      // @ts-expect-error Node's fetch needs duplex for a streaming body; not in the DOM types.
      duplex: "half",
      signal: client.signal,
    });
    setTimeout(() => client.abort(), 10);
    expect(await readJsonBounded(request, 100, { deadlineMs: 10_000 })).toEqual({
      ok: false,
      reason: "aborted",
    });
  });
});

describe("http.bodyErrorResponse", () => {
  it("maps each read failure to a controlled, uncached response", async () => {
    for (const [reason, status, error] of [
      ["too_large", 413, "too_large"],
      ["timeout", 408, "body_timeout"],
      ["aborted", 400, "aborted"],
      ["stream_error", 400, "invalid_body"],
    ] as const) {
      const response = bodyErrorResponse(reason);
      expect([reason, response.status, await response.json()]).toEqual([reason, status, { error }]);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(
      bodyErrorResponse("too_large", { "Cache-Control": "private, no-store" }).headers.get(
        "cache-control",
      ),
    ).toBe("private, no-store");
  });
});

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  let text = "";
  const decoder = new TextDecoder();
  for await (const chunk of stream) text += decoder.decode(chunk, { stream: true });
  return text;
}

describe("http.ndjsonStream", () => {
  it("sends progress and the terminal event, closes, but keeps draining (ledger work)", async () => {
    let drained = false;
    async function* events(): AsyncGenerator<ChatEvent> {
      yield { type: "progress", stage: "reading_guides" };
      yield { type: "crisis", language: "en" };
      await new Promise((resolve) => setTimeout(resolve, 20));
      drained = true;
    }
    const text = await readAll(ndjsonStream(events()));
    expect(text).toBe(
      '{"type":"progress","stage":"reading_guides"}\n{"type":"crisis","language":"en"}\n',
    );
    expect(drained).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(drained).toBe(true);
  });

  it("closes without a terminal event if the iterator ends early (client shows fallback)", async () => {
    async function* events(): AsyncGenerator<ChatEvent> {
      yield { type: "progress", stage: "reading_guides" };
    }
    expect(await readAll(ndjsonStream(events()))).toBe(
      '{"type":"progress","stage":"reading_guides"}\n',
    );
  });

  it("calls onCancel when the client cancels the stream", async () => {
    let cancelled = false;
    async function* events(): AsyncGenerator<ChatEvent> {
      yield { type: "progress", stage: "reading_guides" };
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const stream = ndjsonStream(events(), () => {
      cancelled = true;
    });
    await stream.cancel();
    expect(cancelled).toBe(true);
  });
});

describe("http cookies", () => {
  it("reads one cookie by name", () => {
    expect(readCookie("a=1; lumi_staff=tok%2Ben; b=2", "lumi_staff")).toBe("tok+en");
    expect(readCookie("a=1", "lumi_staff")).toBeUndefined();
    expect(readCookie(null, "lumi_staff")).toBeUndefined();
  });

  it("builds a strict, httpOnly, secure session cookie", () => {
    expect(sessionCookie("lumi_staff", "v", 8 * 3_600_000)).toBe(
      "lumi_staff=v; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800",
    );
  });
});

describe("http.requestContextFrom", () => {
  it("hashes the right-most forwarded IP and links the request signal", () => {
    const controller = new AbortController();
    const request = new Request("http://x/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.9" },
    });
    const ctx = requestContextFrom(request, "salt", controller.signal);
    expect(ctx.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(ctx.rateLimitKey).not.toContain("203.0.113.9");
    expect(ctx.signal.aborted).toBe(false);
    controller.abort();
    expect(ctx.signal.aborted).toBe(true);
  });

  it("puts requests without the header in the shared unknown bucket", () => {
    const ctx = requestContextFrom(new Request("http://x"), "salt");
    expect(ctx.rateLimitKey).toBe("unknown");
  });
});
