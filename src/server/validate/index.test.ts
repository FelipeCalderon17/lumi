import { describe, expect, it } from "vitest";
import { checkCitationIntegrity, extractCitations, findUnsafeOutput } from "./index";

const twelve = new Set(Array.from({ length: 12 }, (_, i) => i + 1));

describe("validate.extractCitations", () => {
  it("parses single and grouped markers, without duplicates, in order", () => {
    expect(extractCitations("Bring a charger [2]. Ask the nurse [1, 3]. Again [2].")).toEqual([
      2, 1, 3,
    ]);
  });

  it("ignores brackets that are not handles", () => {
    expect(extractCitations("See [the guide] or [[NO_ANSWER]] or [a1].")).toEqual([]);
  });
});

describe("validate.checkCitationIntegrity", () => {
  it("returns valid with the cited handles when all exist", () => {
    expect(checkCitationIntegrity("Parking help exists [4]. Ask [4, 7].", twelve)).toEqual({
      status: "valid",
      handles: [4, 7],
    });
  });

  it("returns invalid/unknown_handles for [99] when the KB has 12 articles", () => {
    expect(checkCitationIntegrity("Ask the social worker [3][99].", twelve)).toEqual({
      status: "invalid",
      reason: "unknown_handles",
      unknownHandles: [99],
    });
  });

  it("treats [0] as unknown: handles start at 1", () => {
    expect(checkCitationIntegrity("See [0].", twelve)).toMatchObject({ reason: "unknown_handles" });
  });

  it("returns invalid/no_citations for an answer without markers", () => {
    expect(checkCitationIntegrity("Just ask the hospital.", twelve)).toEqual({
      status: "invalid",
      reason: "no_citations",
      unknownHandles: [],
    });
  });
});

describe("validate.findUnsafeOutput", () => {
  it("flags phone numbers and dosages, allows 911 and tone words", () => {
    expect(findUnsafeOutput("Call 555-123-4567 [1]").map((v) => v.rule)).toEqual(["phone_number"]);
    expect(findUnsafeOutput("Give 5 ml every 4 hours [2]").map((v) => v.rule)).toEqual([
      "dosage",
      "dosage",
    ]);
    expect(findUnsafeOutput("Call 911 in an emergency [1]. Your journey matters.")).toEqual([]);
  });
});
