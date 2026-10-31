import type { Language } from "../types";

/**
 * Contact-detail redaction for saved gap questions (ADR 0005). Kept free of Node imports so the
 * help page can show the parent the SAME redacted preview the server will store; the server
 * runs it again on save.
 */

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
