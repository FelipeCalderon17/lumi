import { describe, expect, it, vi } from "vitest";
import { askLumi, parseEvent, readChatStream } from "./chat-client";

const encoder = new TextEncoder();

/** A body that delivers each chunk as written (chunks may split lines anywhere). */
function streamOf(chunks: string[], { endWithError = false } = {}): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      if (endWithError) controller.error(new Error("network drop"));
      else controller.close();
    },
  });
}

const progress = `${JSON.stringify({ type: "progress", stage: "reading_guides" })}\n`;
const answer = {
  type: "answer",
  language: "en",
  text: "Pack a phone charger [1].",
  citations: [{ handle: 1, articleId: "first-days-at-the-hospital", title: "First days" }],
};

describe("readChatStream", () => {
  it("returns exactly one terminal event and reports progress", async () => {
    const onProgress = vi.fn();
    const outcome = await readChatStream(streamOf([progress, `${JSON.stringify(answer)}\n`]), {
      onProgress,
    });
    expect(outcome).toEqual({ kind: "event", event: answer });
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it("ignores anything after the first terminal event", async () => {
    const second = JSON.stringify({ type: "fallback", reason: "internal", language: "en" });
    const outcome = await readChatStream(streamOf([`${JSON.stringify(answer)}\n${second}\n`]));
    expect(outcome).toEqual({ kind: "event", event: answer });
  });

  it("reassembles a line split across chunks", async () => {
    const line = `${JSON.stringify(answer)}\n`;
    const outcome = await readChatStream(
      streamOf([line.slice(0, 7), line.slice(7, 30), line.slice(30)]),
    );
    expect(outcome).toEqual({ kind: "event", event: answer });
  });

  it("accepts a final line without a trailing newline", async () => {
    const outcome = await readChatStream(streamOf([progress, JSON.stringify(answer)]));
    expect(outcome.kind).toBe("event");
  });

  it("premature EOF (progress only) is a failure, never a partial answer", async () => {
    expect(await readChatStream(streamOf([progress]))).toEqual({ kind: "failed", cause: "eof" });
    expect(await readChatStream(streamOf([]))).toEqual({ kind: "failed", cause: "eof" });
  });

  it("a half-written terminal line at EOF is a failure", async () => {
    const outcome = await readChatStream(streamOf([progress, '{"type":"answer","te']));
    expect(outcome).toEqual({ kind: "failed", cause: "parse" });
  });

  it("a stream error mid-way is a network failure", async () => {
    const outcome = await readChatStream(streamOf([progress], { endWithError: true }));
    expect(outcome).toEqual({ kind: "failed", cause: "network" });
  });

  it("an unparseable or unknown line is a failure", async () => {
    expect(await readChatStream(streamOf(["not json\n"]))).toEqual({
      kind: "failed",
      cause: "parse",
    });
    expect(await readChatStream(streamOf(['{"type":"surprise"}\n']))).toEqual({
      kind: "failed",
      cause: "parse",
    });
  });

  it("stops when the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await readChatStream(streamOf([progress]), { signal: controller.signal })).toEqual({
      kind: "aborted",
    });
  });
});

describe("parseEvent", () => {
  it("rejects terminal events missing the fields the page renders", () => {
    expect(parseEvent(JSON.stringify({ type: "answer", text: "hi" }))).toBeNull();
    expect(parseEvent(JSON.stringify({ type: "medical", language: "en" }))).toBeNull();
    expect(parseEvent(JSON.stringify({ type: "emergency", kind: "other" }))).toBeNull();
    expect(parseEvent(JSON.stringify({ type: "crisis", language: "es" }))).toEqual({
      type: "crisis",
      language: "es",
    });
  });
});

describe("askLumi", () => {
  const ndjson = (body: string, status = 200) =>
    new Response(body, { status, headers: { "Content-Type": "application/x-ndjson" } });

  it("posts the message and locale, and returns the terminal event", async () => {
    const fetchImpl = vi.fn(async () => ndjson(progress + JSON.stringify(answer)));
    const outcome = await askLumi("What do I pack?", "en", { fetchImpl });
    expect(outcome).toEqual({ kind: "event", event: answer });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ message: "What do I pack?", locale: "en" }),
      }),
    );
  });

  it("400 too_long is shown inline; every other HTTP error is the fallback", async () => {
    const tooLong = vi.fn(async () => Response.json({ error: "too_long" }, { status: 400 }));
    expect(await askLumi("x", "en", { fetchImpl: tooLong })).toEqual({ kind: "too_long" });
    for (const status of [400, 408, 413, 500, 503]) {
      const fetchImpl = vi.fn(async () => Response.json({ error: "x" }, { status }));
      expect(await askLumi("x", "es", { fetchImpl })).toEqual({ kind: "failed", cause: "http" });
    }
    const html = vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 }));
    expect(await askLumi("x", "en", { fetchImpl: html })).toEqual({
      kind: "failed",
      cause: "http",
    });
  });

  it("a network error is the fallback; an abort is silent", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await askLumi("x", "en", { fetchImpl: offline })).toEqual({
      kind: "failed",
      cause: "network",
    });
    const controller = new AbortController();
    const aborting = vi.fn(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    expect(await askLumi("x", "en", { fetchImpl: aborting, signal: controller.signal })).toEqual({
      kind: "aborted",
    });
  });
});
