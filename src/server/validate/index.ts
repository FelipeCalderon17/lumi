import { NotImplementedError } from "../types";

/**
 * Citation validation: every [n] in an answer must map to a real KB handle.
 * Runs after the stream completes. An answer with no valid citation (and no abstain marker)
 * is replaced by the safe fallback — we never show ungrounded text as if it were grounded.
 */

export type CitationCheck =
  | { status: "valid"; handles: readonly number[] }
  | { status: "abstained" }
  | {
      status: "invalid";
      reason: "no_citations" | "unknown_handles";
      unknownHandles: readonly number[];
    };

export function extractCitations(_text: string): number[] {
  // TODO(phase-2): parse [n] and [n, m] markers.
  throw new NotImplementedError("validate.extractCitations");
}

export function validateCitations(
  _text: string,
  _knownHandles: ReadonlySet<number>,
): CitationCheck {
  // TODO(phase-2)
  throw new NotImplementedError("validate.validateCitations");
}
