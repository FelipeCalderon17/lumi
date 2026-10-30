import { type ContentViolation, findContentViolations } from "../content-rules";

/**
 * Citation-integrity validation.
 *
 * WHAT IT GUARANTEES: every [n] in an answer maps to a real KB handle, and the answer cites
 * at least one. An answer that fails is never shown; the parent gets the fallback.
 *
 * WHAT IT DOES NOT GUARANTEE: that the cited article actually supports what the sentence says.
 * A valid handle can sit next to an unsupported claim. That is measured offline by the
 * LLM-as-judge groundedness check in the evals (docs/EVALS.md), and reduced by keeping
 * clinical topics off the generated path entirely (medical → fixed template).
 */

export type CitationIntegrity =
  | { status: "valid"; handles: readonly number[] }
  | {
      status: "invalid";
      reason: "no_citations" | "unknown_handles";
      unknownHandles: readonly number[];
    };

/** `[3]` or grouped `[1, 3]`. Anything else in brackets is not a citation. */
const CITATION = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

/** Every cited handle, in order of first appearance, without duplicates. */
export function extractCitations(text: string): number[] {
  const seen = new Set<number>();
  for (const match of text.matchAll(CITATION)) {
    for (const part of (match[1] ?? "").split(",")) seen.add(Number.parseInt(part.trim(), 10));
  }
  return [...seen];
}

export function checkCitationIntegrity(
  text: string,
  knownHandles: ReadonlySet<number>,
): CitationIntegrity {
  const handles = extractCitations(text);
  if (handles.length === 0) {
    return { status: "invalid", reason: "no_citations", unknownHandles: [] };
  }
  const unknownHandles = handles.filter((handle) => !knownHandles.has(handle));
  if (unknownHandles.length > 0) {
    return { status: "invalid", reason: "unknown_handles", unknownHandles };
  }
  return { status: "valid", handles };
}

/**
 * Runtime output check on generated answers: no phone numbers (except 911/988) and no dosages
 * or dosing frequencies, even next to a valid citation. The KB contains neither, so a match
 * means the model added it. Tone words are left to the evals: they're a style problem, not a
 * reason to withhold an answer.
 */
export function findUnsafeOutput(text: string): ContentViolation[] {
  return findContentViolations(text).filter(
    (v) => v.rule === "phone_number" || v.rule === "dosage",
  );
}
