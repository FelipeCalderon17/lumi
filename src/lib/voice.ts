import { config } from "@/server/config";

/**
 * Pure logic for voice notes (ADR 0014): the 2-minute cap, the countdown and the recording
 * format. The component in src/components/voice-input.tsx wires it to MediaRecorder.
 */

export const VOICE_CAP_SECONDS = config.limits.audio.maxSeconds;
/** Low bitrate for speech: 2 minutes stays far below the server's byte cap. */
export const VOICE_BITS_PER_SECOND = 32_000;

/** Whole seconds left, counting down from the cap. Never negative. */
export function remainingSeconds(
  elapsedMs: number,
  capSeconds: number = VOICE_CAP_SECONDS,
): number {
  return Math.max(0, Math.ceil(capSeconds - Math.max(0, elapsedMs) / 1000));
}

/** True once the recording has reached the cap and must stop. */
export function reachedCap(elapsedMs: number, capSeconds: number = VOICE_CAP_SECONDS): boolean {
  return elapsedMs >= capSeconds * 1000;
}

/** 125 → "2:05". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The duration we declare to the server: measured, at least 1 ms, never above the cap. */
export function declaredDurationMs(
  elapsedMs: number,
  capSeconds: number = VOICE_CAP_SECONDS,
): number {
  return Math.min(Math.max(1, Math.round(elapsedMs)), capSeconds * 1000);
}

/** Containers the server accepts, in order of preference (Chrome/Firefox: webm; Safari: mp4). */
const CANDIDATE_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"] as const;

/** The first recording type this browser supports, or null (then the mic isn't offered). */
export function pickRecordingType(isTypeSupported: (type: string) => boolean): string | null {
  return CANDIDATE_TYPES.find((type) => isTypeSupported(type)) ?? null;
}

/** "audio/webm;codecs=opus" → "audio/webm", for the upload's Content-Type. */
export function uploadContentType(recordingType: string): string {
  return recordingType.split(";")[0] ?? recordingType;
}

/** Whether this browser can record at all. Checked on the client only. */
export function voiceSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return false;
  return pickRecordingType((t) => MediaRecorder.isTypeSupported(t)) !== null;
}

/** What the transcribe endpoint can answer, mapped to what the parent sees. */
export type TranscribeOutcome =
  | { kind: "text"; text: string }
  | { kind: "empty" | "too_long" | "busy" | "failed" };

export function interpretTranscription(status: number, body: unknown): TranscribeOutcome {
  if (typeof body !== "object" || body === null) return { kind: "failed" };
  const b = body as Record<string, unknown>;
  if (status === 200 && b.status === "ok" && typeof b.text === "string" && b.text.trim()) {
    return { kind: "text", text: b.text.trim() };
  }
  if (b.status === "empty" || b.error === "empty") return { kind: "empty" };
  if (b.status === "too_long" || b.error === "too_long") return { kind: "too_long" };
  if (b.status === "rate_limited" || b.status === "capacity") return { kind: "busy" };
  return { kind: "failed" };
}
