import { z } from "zod";
import { config } from "../config";
import { KB_TOPICS } from "../knowledge";
import { LANGUAGES, NotImplementedError } from "../types";

/**
 * Gaps: questions the assistant could not answer, saved ONLY when the parent explicitly
 * opts in (ADR 0005). This is NOT anonymous: free text can identify someone. So before saving,
 * the parent sees an editable, minimal preview of the question and a plain disclosure that
 * Lumi staff can read it. We store that edited text, its language, a router-assigned topic
 * and a timestamp. No names, no conversation, no IP or user agent.
 *
 * Retention: rows older than config.gaps.retentionDays are deleted (purged on every save/list).
 * Delete path: staff can delete any row; the parent gets a one-time delete token on save
 * (only its hash is stored) to remove it from the same tab.
 */

export const GAP_TOPICS = [...KB_TOPICS, "other"] as const;

export const GapSubmissionSchema = z
  .object({
    /** The text as the parent edited it in the preview, not the original message. */
    question: z.string().trim().min(1).max(config.limits.maxInputChars),
    language: z.enum(LANGUAGES),
    /** From the `abstained` event (router label). A triage hint for staff, not trusted input. */
    topic: z.enum(GAP_TOPICS),
    /** Must be literally `true`: the parent saw the preview and the "staff can read this" note. */
    consent: z.literal(true),
  })
  .strict();
export type GapSubmission = z.infer<typeof GapSubmissionSchema>;

export type GapRecord = {
  id: string;
  question: string;
  language: GapSubmission["language"];
  topic: GapSubmission["topic"];
  createdAt: Date;
};

export type SavedGap = {
  id: string;
  /** Shown once to the parent; only its hash is stored. */
  deleteToken: string;
};

export interface GapStore {
  save(gap: GapSubmission): Promise<SavedGap>;
  listRecent(limit: number): Promise<GapRecord[]>;
  /** Staff delete. */
  delete(id: string): Promise<void>;
  /** Parent delete with the token returned by save. */
  deleteWithToken(id: string, deleteToken: string): Promise<boolean>;
  /** Removes rows created before `cutoff`. Returns how many were removed. */
  purgeOlderThan(cutoff: Date): Promise<number>;
}

export function retentionCutoff(
  now: Date,
  retentionDays: number = config.gaps.retentionDays,
): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export function redactContactDetails(_question: string): string {
  // TODO(phase-3): strip emails and phone numbers before the preview (best-effort, documented).
  throw new NotImplementedError("gaps.redactContactDetails");
}
