import { interpretCompletion } from "../../src/server/answer";
import { findUnsourcedNumbers } from "../../src/server/content-rules";
import type { KnowledgeBase } from "../../src/server/knowledge";
import type { FinishReason } from "../../src/server/types";
import { checkCitationIntegrity, findUnsafeOutput } from "../../src/server/validate";

/**
 * Why an answer was withheld, worked out AFTER the fact from the raw draft the answer model
 * wrote (captured by the eval's model wrapper) and the same exported pure functions the
 * pipeline runs, in the same order as `interpretCompletion` + `finalizeAnswer`. No hook in
 * src/server is needed and production behaviour is untouched.
 *
 * `layers` lists EVERY layer that would withhold the draft; `first` is the one that actually
 * fired (finalizeAnswer stops at the first failure).
 */
export const WITHHOLDING_LAYERS = [
  "truncated",
  "interrupted",
  "abstain_marker_mid_answer",
  "citation_integrity",
  "phone_number",
  "dosage",
  "number_provenance",
] as const;
export type WithholdingLayer = (typeof WITHHOLDING_LAYERS)[number];

export type Withholding = {
  first: WithholdingLayer;
  layers: WithholdingLayer[];
  /** Dosage / phone matches (the matched text, for a human to judge). */
  unsafeMatches: string[];
  /** Number-provenance keys the cited articles don't contain. */
  unsourced: string[];
  /** Cited handles (valid ones), to show which articles provenance compared against. */
  citedHandles: number[];
};

/**
 * `null` when the draft would have been revealed (nothing withholds it) or when it isn't an
 * answer at all (a clean abstention).
 */
export function attributeWithholding(
  draft: string,
  finishReason: FinishReason,
  kb: KnowledgeBase,
): Withholding | null {
  const interpreted = interpretCompletion(draft, finishReason);
  if (!interpreted.ok) {
    const layer: WithholdingLayer =
      interpreted.reason === "truncated"
        ? "truncated"
        : interpreted.reason === "interrupted"
          ? "interrupted"
          : "abstain_marker_mid_answer";
    return { first: layer, layers: [layer], unsafeMatches: [], unsourced: [], citedHandles: [] };
  }
  if (interpreted.value.kind === "abstained") return null;
  const text = interpreted.value.text;

  const layers: WithholdingLayer[] = [];
  const integrity = checkCitationIntegrity(text, new Set(kb.byHandle.keys()));
  if (integrity.status === "invalid") layers.push("citation_integrity");
  const unsafe = findUnsafeOutput(text);
  if (unsafe.some((v) => v.rule === "phone_number")) layers.push("phone_number");
  if (unsafe.some((v) => v.rule === "dosage")) layers.push("dosage");
  const citedHandles = integrity.status === "valid" ? [...integrity.handles] : [];
  const sources = citedHandles.flatMap((h) => {
    const a = kb.byHandle.get(h);
    return a ? [`${a.title}\n${a.body}`] : [];
  });
  // Provenance only runs on answers with valid citations (finalizeAnswer order).
  const unsourced = integrity.status === "valid" ? findUnsourcedNumbers(text, sources) : [];
  if (unsourced.length > 0) layers.push("number_provenance");

  const [first] = layers;
  if (!first) return null;
  return {
    first,
    layers,
    unsafeMatches: unsafe.map((v) => `${v.rule}: ${v.match}`),
    unsourced,
    citedHandles,
  };
}
