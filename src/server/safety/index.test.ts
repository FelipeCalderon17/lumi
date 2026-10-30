import { describe, expect, it } from "vitest";
import { NotImplementedError } from "../types";
import { checkEmergency } from "./index";

describe("safety.checkEmergency (contract)", () => {
  it("is a stub until Phase 2", () => {
    expect(() => checkEmergency("hello")).toThrow(NotImplementedError);
  });

  it.todo("triggers on EN medical emergency phrases ('not breathing', 'seizure')");
  it.todo("triggers on ES medical emergency phrases ('no respira', 'convulsión')");
  it.todo("triggers self_harm on explicit, imminent EN phrases ('I'm going to kill myself')");
  it.todo("triggers self_harm on explicit, imminent ES phrases ('me voy a quitar la vida')");
  it.todo("does not trigger self_harm on figurative use ('this parking is killing me')");
  it.todo("catches mixed intent ('what should I pack, also he's not breathing well')");
  it.todo("matches regardless of accents and casing ('CONVULSION' / 'convulsión')");
  it.todo("does not trigger on everyday logistics ('parking at the hospital')");
  it.todo("never returns the user's text in the result");
});
