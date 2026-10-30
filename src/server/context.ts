/**
 * Per-request context passed to every stage. Framework-free: the route adapter builds it from
 * the incoming Request (its `signal` aborts when the client disconnects).
 */
export type RequestContext = {
  /** Random UUID. Logged and written to the ledger; never derived from the user. */
  requestId: string;
  /** Hash of the trusted client IP (see clientIpFromForwardedFor). Never the raw IP. */
  rateLimitKey: string;
  /** Aborts when the client disconnects. */
  signal: AbortSignal;
};

/**
 * A signal for one stage: aborts when the request is aborted OR the stage deadline passes,
 * whichever comes first. `signal.reason` tells them apart (TimeoutError vs the client's abort).
 */
export function stageSignal(ctx: Pick<RequestContext, "signal">, deadlineMs: number): AbortSignal {
  return AbortSignal.any([ctx.signal, AbortSignal.timeout(deadlineMs)]);
}

/** True when a stage was aborted by its own deadline rather than by the client going away. */
export function isDeadline(signal: AbortSignal): boolean {
  return (
    signal.aborted && signal.reason instanceof DOMException && signal.reason.name === "TimeoutError"
  );
}
