import { ChatRequestSchema } from "@/server/pipeline";

/**
 * Thin HTTP adapter: parse → hand off to src/server → serialise.
 * No business logic lives here (ADR 0001).
 */
export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  // TODO(phase-1): stream runPipeline(parsed.data) as NDJSON ChatEvents.
  return Response.json({ error: "not_implemented" }, { status: 501 });
}
