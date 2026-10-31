import { type ChatEvent, isTerminal, type TerminalEvent } from "@/server/events";
import type { Language } from "@/server/types";

/**
 * Client side of the chat transport (docs/ARCHITECTURE.md § Transport): POST /api/chat, then
 * read NDJSON until EXACTLY ONE terminal event. Anything else (HTTP error, network error, a line
 * that isn't valid JSON, a stream that ends without a terminal event) becomes `failed`, and the
 * page shows the calm fallback copy. A partial state is never shown as an answer.
 */
export type ChatOutcome =
  | { kind: "event"; event: TerminalEvent }
  /** 400 too_long: shown inline as "please shorten it", not as the fallback. */
  | { kind: "too_long" }
  | { kind: "failed"; cause: "http" | "network" | "eof" | "parse" }
  /** The page cancelled (new question, start over, unmount). Nothing to show. */
  | { kind: "aborted" };

export type AskOptions = {
  signal?: AbortSignal;
  onProgress?: () => void;
  fetchImpl?: typeof fetch;
};

export async function askLumi(
  message: string,
  locale: Language,
  { signal, onProgress, fetchImpl = fetch }: AskOptions = {},
): Promise<ChatOutcome> {
  let response: Response;
  try {
    response = await fetchImpl("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, locale }),
      signal,
    });
  } catch {
    return signal?.aborted ? { kind: "aborted" } : { kind: "failed", cause: "network" };
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 400 && isRecord(body) && body.error === "too_long") {
      return { kind: "too_long" };
    }
    return { kind: "failed", cause: "http" };
  }
  if (!response.body) return { kind: "failed", cause: "eof" };
  return readChatStream(response.body, { signal, onProgress });
}

/**
 * Reads NDJSON events and returns the FIRST terminal event, then stops reading (the server
 * sends nothing after it). Progress events call `onProgress`.
 */
export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  { signal, onProgress }: Pick<AskOptions, "signal" | "onProgress"> = {},
): Promise<ChatOutcome> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const stop = () => reader.cancel().catch(() => {});
  try {
    for (;;) {
      if (signal?.aborted) {
        stop();
        return { kind: "aborted" };
      }
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the unfinished tail unless the stream is over.
      buffer = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        if (line.trim() === "") continue;
        const event = parseEvent(line);
        if (!event) {
          stop();
          return { kind: "failed", cause: "parse" };
        }
        if (isTerminal(event)) {
          stop();
          return { kind: "event", event };
        }
        onProgress?.();
      }
      if (done) return { kind: "failed", cause: "eof" };
    }
  } catch {
    return signal?.aborted ? { kind: "aborted" } : { kind: "failed", cause: "network" };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** One NDJSON line → a well-formed event, or null (treated as a broken stream). */
export function parseEvent(line: string): ChatEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.type !== "string") return null;
  const isCitation = (c: unknown) =>
    isRecord(c) &&
    typeof c.handle === "number" &&
    typeof c.articleId === "string" &&
    typeof c.title === "string";
  switch (value.type) {
    case "progress":
      return value as ChatEvent;
    case "answer":
      return typeof value.text === "string" &&
        Array.isArray(value.citations) &&
        value.citations.every(isCitation)
        ? (value as ChatEvent)
        : null;
    case "medical":
      return isCitation(value.article) ? (value as ChatEvent) : null;
    case "emergency":
      return value.kind === "medical_emergency" || value.kind === "self_harm"
        ? (value as ChatEvent)
        : null;
    case "abstained":
      return typeof value.topic === "string" ? (value as ChatEvent) : null;
    case "fallback":
      return typeof value.reason === "string" ? (value as ChatEvent) : null;
    case "crisis":
    case "off_topic":
      return value as ChatEvent;
    default:
      return null;
  }
}
