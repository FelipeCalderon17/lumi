import { NotImplementedError } from "../types";

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

export function extractCitations(_text: string): number[] {
  // TODO(phase-2): parse [n] and [n, m] markers.
  throw new NotImplementedError("validate.extractCitations");
}

export function checkCitationIntegrity(
  _text: string,
  _knownHandles: ReadonlySet<number>,
): CitationIntegrity {
  // TODO(phase-2)
  throw new NotImplementedError("validate.checkCitationIntegrity");
}
