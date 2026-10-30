import type { Language } from "../types";
import { NotImplementedError } from "../types";

/**
 * Deterministic safety pre-check (ADR 0003).
 *
 * Runs FIRST: before the length check, before rate limiting and before any model call, on
 * the raw user text, with keyword/regex lists in EN and ES. Emergencies are never rate-limited.
 * It must be fast, offline and predictable: no network, no model, no randomness.
 * A false positive costs the parent one extra screen; a false negative can cost much more,
 * so the lists lean towards recall.
 *
 * The copy shown on a match is fixed and human-reviewed. It lives in the UI dictionaries
 * (`safety.*` in src/i18n/dictionaries), so it renders even if this API is down.
 */

export type EmergencyKind =
  /** e.g. "not breathing", "seizure", "no despierta", "convulsiona" → 911 */
  | "medical_emergency"
  /** Explicit, imminent self-harm language in EN/ES ("I'm going to kill myself", "me voy a
   * quitar la vida") → 911 + 988. A backstop: the router's `emotional_crisis` is the main layer. */
  | "self_harm";

export type SafetyCheck =
  | { triggered: false }
  | {
      triggered: true;
      kind: EmergencyKind;
      /** Language of the matched pattern, used to pick the fixed message. */
      language: Language;
      /** Id of the rule that matched (never the user's text), safe to log. */
      ruleId: string;
    };

export function checkEmergency(_text: string): SafetyCheck {
  // TODO(phase-2): normalise (lowercase, strip accents, collapse spaces), match EN+ES rules.
  throw new NotImplementedError("safety.checkEmergency");
}
