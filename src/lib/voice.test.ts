import { describe, expect, it, vi } from "vitest";
import {
  declaredDurationMs,
  formatClock,
  interpretTranscription,
  openMicrophone,
  pickRecordingType,
  reachedCap,
  remainingSeconds,
  uploadContentType,
  VOICE_CAP_SECONDS,
} from "./voice";

describe("voice cap and countdown", () => {
  it("uses the server's 2-minute cap", () => {
    expect(VOICE_CAP_SECONDS).toBe(120);
  });

  it("counts down in whole seconds and never goes below zero", () => {
    expect(remainingSeconds(0)).toBe(120);
    expect(remainingSeconds(400)).toBe(120);
    expect(remainingSeconds(1_000)).toBe(119);
    expect(remainingSeconds(119_001)).toBe(1);
    expect(remainingSeconds(120_000)).toBe(0);
    expect(remainingSeconds(500_000)).toBe(0);
    expect(remainingSeconds(-50)).toBe(120);
  });

  it("stops exactly at the cap", () => {
    expect(reachedCap(119_999)).toBe(false);
    expect(reachedCap(120_000)).toBe(true);
    expect(reachedCap(3_000, 3)).toBe(true);
  });

  it("formats the clock as m:ss", () => {
    expect(formatClock(120)).toBe("2:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(-3)).toBe("0:00");
  });

  it("declares a duration within (0, cap]", () => {
    expect(declaredDurationMs(0)).toBe(1);
    expect(declaredDurationMs(4_321.6)).toBe(4_322);
    expect(declaredDurationMs(121_500)).toBe(120_000);
  });
});

describe("recording format", () => {
  it("prefers webm/opus, then webm, then mp4 (Safari), else none", () => {
    expect(pickRecordingType(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickRecordingType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecordingType(() => false)).toBeNull();
  });

  it("uploads with the base media type", () => {
    expect(uploadContentType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(uploadContentType("audio/mp4")).toBe("audio/mp4");
  });
});

describe("interpretTranscription", () => {
  it("maps each server answer to what the parent sees", () => {
    expect(interpretTranscription(200, { status: "ok", text: " Hola " })).toEqual({
      kind: "text",
      text: "Hola",
    });
    expect(interpretTranscription(200, { status: "ok", text: "  " })).toEqual({ kind: "failed" });
    expect(interpretTranscription(200, { status: "empty" })).toEqual({ kind: "empty" });
    expect(interpretTranscription(400, { error: "too_long" })).toEqual({ kind: "too_long" });
    expect(interpretTranscription(200, { status: "rate_limited" })).toEqual({ kind: "busy" });
    expect(interpretTranscription(200, { status: "failed", reason: "timeout" })).toEqual({
      kind: "failed",
    });
    expect(interpretTranscription(415, { error: "unsupported_type" })).toEqual({
      kind: "failed",
    });
    expect(interpretTranscription(502, null)).toEqual({ kind: "failed" });
  });
});

describe("openMicrophone (a start that resolves after the parent left)", () => {
  /** getUserMedia that resolves only when the test says so, like a slow permission prompt. */
  function delayedGetUserMedia() {
    const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
    const stream = { getTracks: () => tracks } as unknown as MediaStream;
    let resolve: (s: MediaStream) => void = () => {};
    const request = vi.fn(() => new Promise<MediaStream>((r) => (resolve = r)));
    return { tracks, stream, request, grant: () => resolve(stream) };
  }

  it("unmounted while the prompt is open: every track is stopped and no stream is returned", async () => {
    const mic = delayedGetUserMedia();
    let token = 1;
    const mine = token;
    const pending = openMicrophone(mic.request, () => mine === token);
    token += 1; // the component unmounts
    mic.grant();
    const createRecorder = vi.fn();
    const stream = await pending;
    if (stream) createRecorder(stream); // what the component does with the result
    expect(stream).toBeNull();
    expect(createRecorder).not.toHaveBeenCalled();
    for (const track of mic.tracks) expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("still on the page: the stream is handed over untouched", async () => {
    const mic = delayedGetUserMedia();
    const pending = openMicrophone(mic.request, () => true);
    mic.grant();
    expect(await pending).toBe(mic.stream);
    for (const track of mic.tracks) expect(track.stop).not.toHaveBeenCalled();
  });

  it("a denied prompt rejects as before", async () => {
    const denied = new Error("NotAllowedError");
    await expect(
      openMicrophone(
        () => Promise.reject(denied),
        () => true,
      ),
    ).rejects.toBe(denied);
  });
});
