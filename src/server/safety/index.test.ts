import { describe, expect, it } from "vitest";
import { NotImplementedError } from "../types";
import { checkEmergency } from "./index";

describe("safety.checkEmergency (contract)", () => {
  it("is a stub until Phase 1", () => {
    expect(() => checkEmergency("hello")).toThrow(NotImplementedError);
  });

  it.todo("triggers on EN medical emergency phrases ('not breathing', 'seizure')");
  it.todo("triggers on ES medical emergency phrases ('no respira', 'convulsión')");
  it.todo("matches regardless of accents and casing ('CONVULSION' / 'convulsión')");
  it.todo("does not trigger on everyday logistics ('parking at the hospital')");
  it.todo("never returns the user's text in the result");
});
