import { getServerDeps } from "@/server/app";
import { config } from "@/server/config";
import {
  bodyErrorResponse,
  NDJSON_HEADERS,
  ndjsonStream,
  readJsonBounded,
  requestContextFrom,
} from "@/server/http";
import { ChatRequestShapeSchema, startChat } from "@/server/pipeline";

/**
 * Thin HTTP adapter: bounded read → parse → hand off to src/server → serialise NDJSON.
 * No business logic lives here (ADR 0001). Transport contract: docs/ARCHITECTURE.md § Transport.
 */
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  const body = await readJsonBounded(request, config.limits.maxRequestBytes);
  if (!body.ok) return bodyErrorResponse(body.reason);

  const parsed = ChatRequestShapeSchema.safeParse(body.json);
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  const cancel = new AbortController();
  const ctx = requestContextFrom(request, deps.rateLimitSalt, cancel.signal);
  const start = startChat(parsed.data, ctx, deps.chat);
  if (start.kind === "rejected") return Response.json({ error: start.error }, { status: 400 });

  return new Response(
    ndjsonStream(start.events, () => cancel.abort()),
    { headers: NDJSON_HEADERS },
  );
}
