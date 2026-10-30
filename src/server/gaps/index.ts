import { z } from "zod";
import { config } from "../config";
import { LANGUAGES, NotImplementedError } from "../types";

/**
 * Gaps: questions the assistant could not answer, saved ONLY when the parent explicitly
 * opts in (ADR 0005). No names, no conversation, no IP or user agent — just the question,
 * its language and when it was asked. Staff read them in /staff/gaps (ADR 0008).
 */

export const GapSubmissionSchema = z.object({
  question: z.string().trim().min(1).max(config.limits.maxInputChars),
  language: z.enum(LANGUAGES),
  /** Must be literally `true`: no consent, no write. */
  consent: z.literal(true),
});
export type GapSubmission = z.infer<typeof GapSubmissionSchema>;

export type GapRecord = {
  id: string;
  question: string;
  language: GapSubmission["language"];
  createdAt: Date;
};

export interface GapStore {
  save(gap: GapSubmission): Promise<void>;
  listRecent(limit: number): Promise<GapRecord[]>;
}

export function redactContactDetails(_question: string): string {
  // TODO(phase-3): strip emails and phone numbers before saving (best-effort, documented).
  throw new NotImplementedError("gaps.redactContactDetails");
}
