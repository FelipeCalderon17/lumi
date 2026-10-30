/**
 * Framework-free HTTP helpers for the route adapters (Web Streams / fetch types only).
 */

export type BoundedBody = { ok: true; text: string } | { ok: false; reason: "too_large" };

/**
 * Reads a request body as UTF-8, giving up as soon as it exceeds `maxBytes`, so an oversized
 * body is never buffered in full or handed to JSON.parse. Content-Length is not trusted.
 */
export async function readBodyBounded(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<BoundedBody> {
  if (!body) return { ok: true, text: "" };
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: "too_large" };
    }
    text += decoder.decode(value, { stream: true });
  }
  return { ok: true, text: text + decoder.decode() };
}
