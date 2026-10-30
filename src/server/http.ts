/**
 * Framework-free HTTP helpers for the route adapters (Web Streams / fetch types only).
 */
import { config } from "./config";
import type { RequestContext } from "./context";
import { type ChatEvent, encodeEvent, isTerminal } from "./events";
import { clientIpFromForwardedFor, rateLimitKeyFor } from "./rate-limit";

export type BoundedBody = { ok: true; text: string } | { ok: false; reason: "too_large" };
export type BoundedBytes = { ok: true; bytes: Uint8Array } | { ok: false; reason: "too_large" };

/**
 * Reads a request body as bytes, giving up as soon as it exceeds `maxBytes`, so an oversized
 * body is never buffered in full. Content-Length is not trusted.
 */
export async function readBytesBounded(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<BoundedBytes> {
  if (!body) return { ok: true, bytes: new Uint8Array(0) };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: "too_large" };
    }
    chunks.push(value);
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
): Promise<BoundedBody> {
  const read = await readBytesBounded(body, maxBytes);
  if (!read.ok) return read;
  return { ok: true, text: new TextDecoder().decode(read.bytes) };
}

/** Bounded read + JSON.parse. `null` for invalid JSON, so the caller's Zod check rejects it. */
export async function readJsonBounded(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; json: unknown } | { ok: false; reason: "too_large" }> {
  const body = await readBodyBounded(request.body, maxBytes);
  if (!body.ok) return body;
  try {
    return { ok: true, json: JSON.parse(body.text) };
  } catch {
    return { ok: true, json: null };
  }
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
