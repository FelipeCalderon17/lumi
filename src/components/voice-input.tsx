"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { fill } from "@/i18n/format";
import {
  declaredDurationMs,
  formatClock,
  interpretTranscription,
  openMicrophone,
  pickRecordingType,
  reachedCap,
  remainingSeconds,
  uploadContentType,
  VOICE_BITS_PER_SECOND,
  voiceSupported,
} from "@/lib/voice";

type Phase =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "recording"; elapsedMs: number }
  | { kind: "uploading" }
  | { kind: "review" }
  | { kind: "error"; message: "denied" | "empty" | "tooLong" | "busy" | "failed" };

/**
 * Voice → text (ADR 0014). Records with MediaRecorder up to the 2-minute cap (visible
 * countdown, auto-stop), uploads once to /api/transcribe, and hands the text back for the
 * parent to EDIT before it's used. Audio lives only in memory until the upload ends; nothing is
 * kept on the device. Browsers that can't record don't see the mic at all.
 */
export function VoiceInput({
  locale,
  t,
  onText,
  disabled = false,
}: {
  locale: Locale;
  t: Dictionary;
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const upload = useRef<AbortController | null>(null);
  /** Bumped on unmount: a pending getUserMedia from an older start is then ignored. */
  const startToken = useRef(0);
  const v = t.voice;

  useEffect(() => setSupported(voiceSupported()), []);

  const releaseMic = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
  }, []);

  // Leaving the page stops everything: the mic, the timer, any upload and any pending start.
  useEffect(
    () => () => {
      startToken.current += 1;
      upload.current?.abort();
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      releaseMic();
      chunks.current = [];
    },
    [releaseMic],
  );

  const send = useCallback(
    async (blob: Blob, elapsedMs: number, type: string) => {
      setPhase({ kind: "uploading" });
      const controller = new AbortController();
      upload.current = controller;
      try {
        const params = new URLSearchParams({
          locale,
          durationMs: String(declaredDurationMs(elapsedMs)),
        });
        const response = await fetch(`/api/transcribe?${params}`, {
          method: "POST",
          headers: { "Content-Type": uploadContentType(type) },
          body: blob,
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);
        const outcome = interpretTranscription(response.status, body);
        if (outcome.kind === "text") {
          onText(outcome.text);
          setPhase({ kind: "review" });
        } else {
          const message = outcome.kind === "too_long" ? "tooLong" : outcome.kind;
          setPhase({ kind: "error", message });
        }
      } catch {
        if (!controller.signal.aborted) setPhase({ kind: "error", message: "failed" });
      } finally {
        upload.current = null;
      }
    },
    [locale, onText],
  );

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    const type = pickRecordingType((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!type) {
      setSupported(false);
      return;
    }
    setPhase({ kind: "starting" });
    const token = ++startToken.current;
    const isCurrent = () => token === startToken.current;
    let opened: MediaStream | null;
    try {
      opened = await openMicrophone(
        () => navigator.mediaDevices.getUserMedia({ audio: true }),
        isCurrent,
      );
    } catch (error) {
      if (!isCurrent()) return;
      releaseMic();
      const name = error instanceof DOMException ? error.name : "";
      setPhase({
        kind: "error",
        message: name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed",
      });
      return;
    }
    // The page was left while the permission prompt was open: the tracks are already stopped.
    if (!opened) return;
    stream.current = opened;
    chunks.current = [];
    const media = new MediaRecorder(opened, {
      mimeType: type,
      audioBitsPerSecond: VOICE_BITS_PER_SECOND,
    });
    recorder.current = media;
    media.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data);
    };
    media.onstop = () => {
      const elapsedMs = Date.now() - startedAt.current;
      releaseMic();
      const blob = new Blob(chunks.current, { type: uploadContentType(type) });
      chunks.current = [];
      if (blob.size === 0) setPhase({ kind: "error", message: "empty" });
      else void send(blob, elapsedMs, type);
    };
    startedAt.current = Date.now();
    media.start(1_000);
    setPhase({ kind: "recording", elapsedMs: 0 });
    timer.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAt.current;
      if (reachedCap(elapsedMs)) stop();
      else setPhase({ kind: "recording", elapsedMs });
    }, 250);
  }, [releaseMic, send, stop]);

  if (!supported) return null;

  const recording = phase.kind === "recording";
  const busy = phase.kind === "starting" || phase.kind === "uploading";
  const status =
    phase.kind === "recording"
      ? v.recording
      : phase.kind === "uploading"
        ? v.uploading
        : phase.kind === "review"
          ? v.review
          : phase.kind === "error"
            ? v[phase.message]
            : null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled || busy}
        aria-label={recording ? v.stopLabel : v.startLabel}
        aria-pressed={recording}
        className={`inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-55 ${
          recording
            ? "border-ember/70 text-ember hover:bg-ember/10"
            : "border-line text-text hover:border-glow hover:bg-raised"
        }`}
      >
        {recording ? (
          <span aria-hidden="true" className="size-3 rounded-[3px] bg-ember" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
          </svg>
        )}
        {recording ? v.stop : v.start}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={`min-w-0 text-[0.95rem] ${phase.kind === "error" ? "text-ember" : "text-muted"}`}
      >
        {recording && (
          <span
            aria-hidden="true"
            className="mr-2 inline-block size-2 animate-breathe rounded-pill bg-ember align-middle"
          />
        )}
        {status ?? <span className="sr-only">{v.hint}</span>}
      </p>
      {/* The countdown is visible but not announced every second; the status above is. */}
      {phase.kind === "recording" && (
        <span aria-hidden="true" className="font-semibold text-[0.95rem] text-text tabular-nums">
          {fill(v.remaining, { time: formatClock(remainingSeconds(phase.elapsedMs)) })}
        </span>
      )}
    </div>
  );
}
