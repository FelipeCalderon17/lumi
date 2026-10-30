/**
 * Structured logs: request id, stage, outcome, rule id, durations. NEVER message content,
 * transcripts, notes, IPs or keys (docs/ARCHITECTURE.md § Privacy). The type only allows
 * short identifiers and numbers, so free text has nowhere to go.
 */
export type LogEvent = {
  requestId: string;
  event: string;
  outcome?: string;
  reason?: string;
  ruleId?: string;
  ms?: number;
};

export type Logger = (event: LogEvent) => void;

export const consoleLogger: Logger = (event) => {
  console.info(JSON.stringify({ at: new Date().toISOString(), ...event }));
};

export const silentLogger: Logger = () => {};
