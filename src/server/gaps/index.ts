import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { config } from "../config";
import { withTimeout } from "../context";
import { KB_TOPICS } from "../knowledge";
import { LANGUAGES, type Language } from "../types";

/**
 * Gaps: questions the assistant could not answer, saved ONLY when the parent explicitly
 * opts in (ADR 0005). This is NOT anonymous: free text can identify someone. So before saving,
 * the parent sees an editable, minimal preview of the question and a plain disclosure that
 * Lumi staff can read it. We store that edited text, its language, a router-assigned topic
 * and a timestamp. No separate name field, conversation history, IP or user agent is stored;
 * the question text may contain identifying details.
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

export const GapDeleteSchema = z.object({ deleteToken: z.string().min(16).max(128) }).strict();
export const GapIdSchema = z.uuid();

export type GapRecord = {
  id: string;
  question: string;
  language: GapSubmission["language"];
  topic: GapSubmission["topic"];
  createdAt: Date;
};

/** Storage, implemented with Drizzle in src/db/stores.ts. `null` when there's no database. */
export interface GapStore {
  insert(row: {
    question: string;
    language: GapSubmission["language"];
    topic: GapSubmission["topic"];
    deleteTokenHash: string;
  }): Promise<{ id: string }>;
  listRecent(limit: number): Promise<GapRecord[]>;
  /** Staff delete. */
  delete(id: string): Promise<boolean>;
  /** Parent delete: removes the row only if the token hash matches. */
  deleteWithTokenHash(id: string, deleteTokenHash: string): Promise<boolean>;
  /** Removes rows created before `cutoff`. Returns how many were removed. */
  purgeOlderThan(cutoff: Date): Promise<number>;
}

export function retentionCutoff(
  now: Date,
  retentionDays: number = config.gaps.retentionDays,
): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
/** Same shape as the content rules' phone check: 7+ digits with optional separators. */
const PHONE = /(?:\+|\()?(?:\d[\s().-]*){6,}\d/g;
const REMOVED: Record<Language, { email: string; phone: string }> = {
  en: { email: "[email removed]", phone: "[phone removed]" },
  es: { email: "[correo eliminado]", phone: "[teléfono eliminado]" },
};

/**
 * Best-effort removal of emails and phone numbers. Used for the preview the parent edits AND
 * again on save. It can't catch names or places in free text: that's why the parent sees and
 * edits the preview, and why we never call gaps anonymous.
 */
export function redactContactDetails(question: string, language: Language = "en"): string {
  return question.replace(EMAIL, REMOVED[language].email).replace(PHONE, REMOVED[language].phone);
}

export function newDeleteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashDeleteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type GapSaveResult =
  | { status: "saved"; id: string; deleteToken: string }
  /** No database in this deployment (demo mode). */
  | { status: "unavailable" }
  | { status: "failed" };

/**
 * Purges expired rows (lazy retention), then saves the redacted question with the hash of a
 * fresh one-time delete token. The token goes back to the parent once and is never stored.
 */
export async function saveGap(
  submission: GapSubmission,
  store: GapStore | null,
  now: Date = new Date(),
  timeoutMs: number = config.timeouts.dbMs,
): Promise<GapSaveResult> {
  if (!store) return { status: "unavailable" };
  const deleteToken = newDeleteToken();
  try {
    await withTimeout(store.purgeOlderThan(retentionCutoff(now)), timeoutMs);
    const { id } = await withTimeout(
      store.insert({
        question: redactContactDetails(submission.question, submission.language),
        language: submission.language,
        topic: submission.topic,
        deleteTokenHash: hashDeleteToken(deleteToken),
      }),
      timeoutMs,
    );
    return { status: "saved", id, deleteToken };
  } catch {
    return { status: "failed" };
  }
}

export type GapDeleteResult = { status: "deleted" | "not_found" | "unavailable" | "failed" };

export async function deleteGapWithToken(
  id: string,
  deleteToken: string,
  store: GapStore | null,
  timeoutMs: number = config.timeouts.dbMs,
): Promise<GapDeleteResult> {
  if (!store) return { status: "unavailable" };
  try {
    const deleted = await withTimeout(
      store.deleteWithTokenHash(id, hashDeleteToken(deleteToken)),
      timeoutMs,
    );
    return { status: deleted ? "deleted" : "not_found" };
  } catch {
    return { status: "failed" };
  }
}

/** Staff list: purge first, so nothing past retention is ever shown. */
export async function listGapsForStaff(
  store: GapStore,
  now: Date = new Date(),
  timeoutMs: number = config.timeouts.dbMs,
): Promise<GapRecord[]> {
  await withTimeout(store.purgeOlderThan(retentionCutoff(now)), timeoutMs);
  return withTimeout(store.listRecent(config.gaps.listLimit), timeoutMs);
}
