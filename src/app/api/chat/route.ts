import { config } from "@/server/config";
import { readBodyBounded } from "@/server/http";
import { ChatRequestShapeSchema } from "@/server/pipeline";

/**
 * Thin HTTP adapter: bounded read → parse → hand off to src/server → serialise NDJSON.
 * No business logic lives here (ADR 0001). Transport contract: docs/ARCHITECTURE.md § Transport.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await readBodyBounded(request.body, config.limits.maxRequestBytes);
  if (!body.ok) return Response.json({ error: "too_large" }, { status: 413 });

  let json: unknown = null;
  try {
    json = JSON.parse(body.text);
  } catch {
    // Fall through to the shape check, which rejects null.
  }
  const parsed = ChatRequestShapeSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  // TODO(phase-2): build RequestContext (requestId, hashed client IP, request.signal) and stream
  // runPipeline(...) as NDJSON ChatEvents. Safety runs inside the pipeline before the length
  // check and before rate limiting.
  return Response.json({ error: "not_implemented" }, { status: 501 });
}
