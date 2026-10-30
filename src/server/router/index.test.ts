import { describe, expect, it } from "vitest";
import { RouterOutputSchema, resolveCategory, toRoute } from "./index";

describe("router.RouterOutputSchema (contract)", () => {
  it("accepts a valid output with several intents", () => {
    const output = {
      language: "es",
      intents: ["practical", "medical"],
      topic: "hospital-logistics",
    };
    expect(RouterOutputSchema.parse(output)).toEqual(output);
  });

  it("rejects unknown categories, languages, topics and empty intents", () => {
    const base = { language: "en", intents: ["practical"], topic: "other" };
    expect(RouterOutputSchema.safeParse({ ...base, intents: ["billing"] }).success).toBe(false);
    expect(RouterOutputSchema.safeParse({ ...base, intents: [] }).success).toBe(false);
    expect(RouterOutputSchema.safeParse({ ...base, language: "fr" }).success).toBe(false);
    expect(RouterOutputSchema.safeParse({ ...base, topic: "weather" }).success).toBe(false);
  });
});

describe("router.resolveCategory (precedence)", () => {
  it("immediate danger beats everything", () => {
    expect(resolveCategory(["practical", "urgent"])).toBe("urgent");
    expect(resolveCategory(["emotional_crisis", "urgent", "medical"])).toBe("urgent");
  });

  it("crisis beats medical, medical beats practical, practical beats off_topic", () => {
    expect(resolveCategory(["medical", "emotional_crisis"])).toBe("emotional_crisis");
    expect(resolveCategory(["practical", "medical"])).toBe("medical");
    expect(resolveCategory(["off_topic", "practical"])).toBe("practical");
    expect(resolveCategory(["off_topic"])).toBe("off_topic");
  });

  it("toRoute applies precedence to the model's intents", () => {
    expect(
      toRoute({ language: "en", intents: ["practical", "urgent"], topic: "hospital-logistics" }),
    ).toEqual({ language: "en", category: "urgent", topic: "hospital-logistics" });
  });
});

describe("router.routeQuestion (planned, Phase 2)", () => {
  it.todo("maps a timeout to { result: { ok: false, reason: 'timeout' }, call: {...} }");
  it.todo("maps schema-invalid model output to invalid_output and still returns call metadata");
  it.todo("reports unknown token usage as null, not 0");
});
