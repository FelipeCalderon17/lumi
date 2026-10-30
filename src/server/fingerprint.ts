import { createHash } from "node:crypto";
import { ANSWER_POLICY_VERSION, buildSystemPrefix } from "./answer";
import type { KnowledgeBase } from "./knowledge";
import { NOTEBOOK_PROMPT_VERSION, NOTEBOOK_SYSTEM } from "./notebook";
import { ROUTER_PROMPT_VERSION, ROUTER_SYSTEM } from "./router";
import type { Language } from "./types";

/**
 * What an eval run records to prove its inputs were frozen (docs/EVALS.md): a hash of the KB
 * per language and a hash of every prompt the run can send. Same files → same hashes.
 */
export type Fingerprint = {
  kb: Record<Language, string>;
  prompts: string;
  versions: { router: number; answer: number; notebook: number };
};

export function fingerprint(kbs: Record<Language, KnowledgeBase>): Fingerprint {
  const prompts = createHash("sha256");
  for (const part of [
    ROUTER_SYSTEM,
    buildSystemPrefix(kbs.en),
    buildSystemPrefix(kbs.es),
    NOTEBOOK_SYSTEM,
  ]) {
    prompts.update(part).update("\u0000");
  }
  return {
    kb: { en: kbs.en.hash, es: kbs.es.hash },
    prompts: prompts.digest("hex"),
    versions: {
      router: ROUTER_PROMPT_VERSION,
      answer: ANSWER_POLICY_VERSION,
      notebook: NOTEBOOK_PROMPT_VERSION,
    },
  };
}
