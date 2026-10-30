import { describe, expect, it } from "vitest";
import { isDeadline, stageSignal } from "./context";

describe("context.stageSignal", () => {
  it("aborts when the request is aborted (client disconnect), and it is not a deadline", () => {
    const request = new AbortController();
    const signal = stageSignal({ signal: request.signal }, 60_000);
    expect(signal.aborted).toBe(false);
    request.abort();
    expect(signal.aborted).toBe(true);
    expect(isDeadline(signal)).toBe(false);
  });

  it("aborts with a TimeoutError when the stage deadline passes first", async () => {
    const request = new AbortController();
    const signal = stageSignal({ signal: request.signal }, 5);
    await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
    expect(isDeadline(signal)).toBe(true);
    expect(request.signal.aborted).toBe(false);
  });
});
