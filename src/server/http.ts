/**
 * Framework-free HTTP helpers for the route adapters (Web Streams / fetch types only).
 */
import { config } from "./config";
import type { RequestContext } from "./context";
import { type ChatEvent, encodeEvent, isTerminal } from "./events";
import { clientIpFromForwardedFor, rateLimitKeyFor } from "./rate-limit";

/** Why a body couldn't be read. Each maps to a controlled response (bodyErrorResponse). */
export type BodyReadError =
  /** More than maxBytes: we stop reading at the limit. */
  | "too_large"
  /** Still arriving after the read deadline (a stalled or trickling client). */
  | "timeout"
  /** The client went away (request signal aborted). */
  | "aborted"
  /** The stream itself errored. */
  | "stream_error";

export type BoundedBody = { ok: true; text: string } | { ok: false; reason: BodyReadError };
export type BoundedBytes = { ok: true; bytes: Uint8Array } | { ok: false; reason: BodyReadError };

export type BodyReadOptions = {
  /** The request's signal: reading stops as soon as the client goes away. */
  signal?: AbortSignal;
  /** Read deadline for the whole body. Default config.timeouts.bodyReadMs. */
  deadlineMs?: number;
  /** Most we wait for the stream's cancel() when giving up. Default config.timeouts.bodyCancelMs. */
  cancelWaitMs?: number;
};

/** Waits for `promise`, but never longer than `ms`. Never rejects. */
async function settleWithin(promise: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  try {
    await Promise.race([promise.then(noop, noop), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
const noop = () => {};
const cancelWaitOf = (options: BodyReadOptions) =>
  options.cancelWaitMs ?? config.timeouts.bodyCancelMs;

/**
 * Reads a request body as bytes, giving up as soon as it exceeds `maxBytes`, so an oversized
 * body is never buffered in full. Content-Length is not trusted. Bounded in time too: a read
 * deadline and the request's signal stop a stalled or abandoned upload, and the stream's
 * cancel() is awaited for at most `cancelWaitMs`, so a cancel that never settles can't hold the
 * request open. The abort state is checked before every read and before accepting each result,
 * so an already-aborted request fails even when its body is buffered or empty (Codex re-review
 * 3). Never throws.
 */
export async function readBytesBounded(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  options: BodyReadOptions = {},
): Promise<BoundedBytes> {
  if (options.signal?.aborted) {
    if (body)
      await settleWithin(
        Promise.resolve().then(() => body.cancel()),
        cancelWaitOf(options),
      );
    return { ok: false, reason: "aborted" };
  }
  if (!body) return { ok: true, bytes: new Uint8Array(0) };
  const deadline = AbortSignal.timeout(options.deadlineMs ?? config.timeouts.bodyReadMs);
  const stop = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  const cancelWaitMs = cancelWaitOf(options);
  const stopReason = (): BodyReadError => (options.signal?.aborted ? "aborted" : "timeout");

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = body.getReader();
  } catch {
    return { ok: false, reason: "stream_error" }; // already locked or disturbed
  }
  const giveUp = async (reason: BodyReadError): Promise<BoundedBytes> => {
    await settleWithin(
      Promise.resolve().then(() => reader.cancel()),
      cancelWaitMs,
    );
    return { ok: false, reason };
  };

  let onStop = noop;
  const stopped = new Promise<"stopped">((resolve) => {
    onStop = () => resolve("stopped");
  });
  if (stop.aborted) onStop();
  else stop.addEventListener("abort", onStop, { once: true });

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      if (stop.aborted) return await giveUp(stopReason());
      const read = reader.read();
      read.catch(noop); // if we stop waiting, a later rejection must not go unhandled
      let next: Awaited<typeof read> | "stopped";
      try {
        next = await Promise.race([read, stopped]);
      } catch {
        return await giveUp(stop.aborted ? stopReason() : "stream_error");
      }
      // A buffered chunk can win the race against an abort that already happened.
      if (next === "stopped" || stop.aborted) return await giveUp(stopReason());
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) return await giveUp("too_large");
      chunks.push(next.value);
    }
  } finally {
    stop.removeEventListener("abort", onStop);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

/**
 * Reads a request body as UTF-8, giving up as soon as it exceeds `maxBytes`, so an oversized
 * body is never buffered in full or handed to JSON.parse. Content-Length is not trusted.
 */
export async function readBodyBounded(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  options: BodyReadOptions = {},
): Promise<BoundedBody> {
  const read = await readBytesBounded(body, maxBytes, options);
  if (!read.ok) return read;
  return { ok: true, text: new TextDecoder().decode(read.bytes) };
}

/**
 * Bounded read + JSON.parse, stopped by the request's own signal. `null` for invalid JSON, so
 * the caller's Zod check rejects it.
 */
export async function readJsonBounded(
  request: Request,
  maxBytes: number,
  options: Omit<BodyReadOptions, "signal"> = {},
): Promise<{ ok: true; json: unknown } | { ok: false; reason: BodyReadError }> {
  const body = await readBodyBounded(request.body, maxBytes, {
    ...options,
    signal: request.signal,
  });
  if (!body.ok) return body;
  try {
    return { ok: true, json: JSON.parse(body.text) };
  } catch {
    return { ok: true, json: null };
  }
}

const BODY_ERRORS: Record<BodyReadError, { status: number; error: string }> = {
  too_large: { status: 413, error: "too_large" },
  timeout: { status: 408, error: "body_timeout" },
  aborted: { status: 400, error: "aborted" },
  stream_error: { status: 400, error: "invalid_body" },
};

/** The controlled response for a body that couldn't be read. Never cached. */
export function bodyErrorResponse(
  reason: BodyReadError,
  headers: Record<string, string> = { "Cache-Control": "no-store" },
): Response {
  const { status, error } = BODY_ERRORS[reason];
  return Response.json({ error }, { status, headers });
}

/**
 * RequestContext for one request: a random id, a salted hash of the trusted client IP
 * (right-most X-Forwarded-For entry), and a signal that aborts when the client goes away.
 */
export function requestContextFrom(
  request: Request,
  salt: string,
  extraSignal?: AbortSignal,
): RequestContext {
  const ip = clientIpFromForwardedFor(
    request.headers.get("x-forwarded-for"),
    config.clientIp.trustedProxyHops,
  );
  return {
    requestId: crypto.randomUUID(),
    rateLimitKey: rateLimitKeyFor(ip, salt),
    signal: extraSignal ? AbortSignal.any([request.signal, extraSignal]) : request.signal,
  };
}

export const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

/**
 * Serialises chat events as NDJSON. Closes the stream right after the terminal event, then
 * keeps draining the iterator WITHOUT sending, so work scheduled after the terminal event
 * (the ledger write) still runs but can't delay the response. If the client cancels the
 * stream, `onCancel` fires (the route aborts the request context).
 */
export function ndjsonStream(
  events: AsyncIterable<ChatEvent>,
  onCancel?: () => void,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let open = true;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        try {
          for await (const event of events) {
            if (!open) continue;
            controller.enqueue(encoder.encode(encodeEvent(event)));
            if (isTerminal(event)) {
              open = false;
              controller.close();
            }
          }
        } catch {
          // exactlyOneTerminal never throws; if something does, the client sees EOF without a
          // terminal event and shows the fallback (transport contract).
        }
        if (open) {
          open = false;
          controller.close();
        }
      })();
    },
    cancel() {
      open = false;
      onCancel?.();
    },
  });
}

/** Value of one cookie from a Cookie header, or undefined. */
export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** Set-Cookie for the staff session (ADR 0008): httpOnly, secure, sameSite=strict, path=/. */
export function sessionCookie(name: string, value: string, maxAgeMs: number): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`,
  ].join("; ");
}

export const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" } as const;
