import type { Dictionary } from "@/i18n";
import type { NotebookSafetyNotice } from "@/server/notebook";
import { checkEmergency, type EmergencyKind } from "@/server/safety";

/**
 * Safety notices for the notebook page, on the device (ADR 0003, 0016). The server checks every
 * note before preparing; this runs the SAME deterministic check (src/server/safety: pure, no
 * Node APIs) so pages built here, by date or offline, are flagged too.
 */

/** One notice per note that matches the safety check. `noteIndex` is the index in `notes`. */
export function localSafetyNotices(notes: readonly { text: string }[]): NotebookSafetyNotice[] {
  return notes.flatMap(({ text }, noteIndex) => {
    const safety = checkEmergency(text);
    if (!safety.triggered) return [];
    return [{ kind: safety.kind, detectedBy: "safety", language: safety.language, noteIndex }];
  });
}

/** Medical emergencies first, as in the safety rules. */
const KIND_ORDER: readonly EmergencyKind[] = ["medical_emergency", "self_harm"];

/** The distinct kinds to show, in a fixed order, from any number of notice lists. */
export function noticeKinds(
  ...lists: readonly (readonly NotebookSafetyNotice[])[]
): EmergencyKind[] {
  const found = new Set(lists.flat().map((notice) => notice.kind));
  return KIND_ORDER.filter((kind) => found.has(kind));
}

export type NoticeCopy = { title: string; body: string; steps: readonly string[] };

/** The fixed, reviewed copy for one kind, in the dictionary's language (screen AND export). */
export function noticeCopy(kind: EmergencyKind, t: Dictionary): NoticeCopy {
  return kind === "self_harm"
    ? {
        title: t.notebook.selfHarmTitle,
        body: t.notebook.safetyBody,
        steps: t.safety.selfHarm.steps,
      }
    : {
        title: t.notebook.safetyTitle,
        body: t.notebook.safetyBody,
        steps: t.safety.emergency.steps,
      };
}

/** The notices as plain-text lines for Copy/Share: title, body and every step, per kind. */
export function noticeLines(kinds: readonly EmergencyKind[], t: Dictionary): string[] {
  return kinds.flatMap((kind, i) => {
    const copy = noticeCopy(kind, t);
    return [...(i > 0 ? [""] : []), copy.title, copy.body, ...copy.steps.map((s) => `- ${s}`)];
  });
}
