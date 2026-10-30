import type { Language } from "../types";
import { NotImplementedError } from "../types";

/**
 * Deterministic emergency pre-check (ADR 0003).
 *
 * Runs BEFORE any model call, on the raw user text, with keyword/regex lists in EN and ES.
 * It must be fast, offline and predictable: no network, no model, no randomness.
 * A false positive costs the parent one extra screen; a false negative can cost much more,
 * so the lists lean towards recall.
 */

export type EmergencyKind =
  /** e.g. "not breathing", "seizure", "fiebre de 40", "no despierta" */
  | "medical_emergency"
  /** Explicit self-harm intent. Open question for Phase 1 — see docs/ARCHITECTURE.md. */
  | "self_harm";

export type SafetyCheck =
  | { triggered: false }
  | {
      triggered: true;
      kind: EmergencyKind;
      /** Language of the matched pattern, used to pick the fixed message. */
      language: Language;
      /** Id of the rule that matched (never the user's text) — safe to log. */
      ruleId: string;
    };

export type EmergencyMessage = {
  title: string;
  /** Fixed, human-reviewed steps. Never model-generated. */
  steps: readonly string[];
};

export function checkEmergency(_text: string): SafetyCheck {
  // TODO(phase-1): normalise (lowercase, strip accents), match EN+ES rule lists.
  throw new NotImplementedError("safety.checkEmergency");
}

export function emergencyMessage(_kind: EmergencyKind, _language: Language): EmergencyMessage {
  // TODO(phase-1): fixed copy in both languages ("call 911", hospital emergency line, care team).
  throw new NotImplementedError("safety.emergencyMessage");
}
