import { getServerDeps } from "@/server/app";
import { config } from "@/server/config";
import { bodyErrorResponse, readBytesBounded, requestContextFrom } from "@/server/http";
import { handleTranscription, TranscribeQuerySchema } from "@/server/transcribe";

/**
 * Voice → text (ADR 0014). Body: the raw recording (audio/webm, audio/mp4, audio/m4a).
 * Query: ?locale=en&durationMs=12345. Returns text only; audio stays in memory for this request
 * and is never stored, written to disk or logged.
 */
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  const query = TranscribeQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  const body = await readBytesBounded(request.body, config.limits.audio.maxBytes, {
    signal: request.signal,
    deadlineMs: config.timeouts.audioBodyReadMs,
  });
  if (!body.ok) return bodyErrorResponse(body.reason);

  const ctx = requestContextFrom(request, deps.rateLimitSalt);
  const { httpStatus, body: result } = await handleTranscription(
    {
      audio: body.bytes,
      contentType: request.headers.get("content-type"),
      durationMs: query.data.durationMs,
    },
    ctx,
    {
      model: deps.models.transcription(config.models.transcribe),
      limiters: { transcribe: deps.limiters.transcribe, modelCalls: deps.limiters.modelCalls },
      ledger: deps.ledger,
      log: deps.log,
    },
  );
  return Response.json(result, { status: httpStatus, headers: { "Cache-Control": "no-store" } });
}
