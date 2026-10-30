import { describe, expect, it } from "vitest";
import { AI_PROCESSOR_NAME, findContentViolations } from "./content-rules";

const rules = (text: string) => findContentViolations(text).map((v) => v.rule);

describe("content-rules.findContentViolations", () => {
  it("allows 911 and 988", () => {
    expect(rules("Call 911 now. Call or text 988.")).toEqual([]);
  });

  it("flags other phone numbers and N11 codes", () => {
    expect(rules("Call 555-123-4567")).toEqual(["phone_number"]);
    expect(rules("Llama al (555) 123 4567")).toEqual(["phone_number"]);
    expect(rules("Dial 1-800-555-0100")).toEqual(["phone_number"]);
    expect(rules("Call 211 for help")).toEqual(["phone_number"]);
  });

  it("flags dosages and dosing frequencies in EN and ES", () => {
    expect(rules("Give 5 ml")).toEqual(["dosage"]);
    expect(rules("200mg twice")).toEqual(["dosage"]);
    expect(rules("dale 2,5 ml cada 6 horas")).toEqual(["dosage", "dosage"]);
    expect(rules("give it every 4 hours")).toEqual(["dosage"]);
    expect(rules("Give the syrup twice a day")).toEqual(["dosage"]);
  });

  it("regression (Codex review 3): spelled-out units, written quantities, frequency with dose", () => {
    expect(rules("Give 5 milligrams twice daily [1]")).toEqual(["dosage", "dosage"]);
    expect(rules("Dale 5 miligramos cada mañana [1]")).toEqual(["dosage", "dosage"]);
    expect(rules("Give one tablet [1]")).toEqual(["dosage"]);
    for (const text of [
      "10 micrograms",
      "2.5 millilitres",
      "3 mililitros",
      "5 cc",
      "4 units",
      "8 unidades",
      "2 drops",
      "3 gotas",
      "1 teaspoon",
      "2 cucharaditas",
      "2 puffs",
      "2 inhalaciones",
      "half a tablet",
      "two capsules",
      "one dose",
      "media pastilla",
      "dos cápsulas",
      "una pastilla",
      "una dosis",
      "tres gotas",
    ]) {
      expect([text, rules(text)]).toEqual([text, ["dosage"]]);
    }
  });

  it("keeps harmless numbers and frequencies (Codex review 3 can-wait)", () => {
    for (const text of [
      "take 2 snacks",
      "room 911",
      "We're in room 211",
      "Está en la habitación 311",
      "take a break every 2 hours",
      "every 4 hours",
      "Trae una tableta con películas",
      "Visiting hours are twice a day",
      "dale un abrazo cada mañana",
    ]) {
      expect([text, rules(text)]).toEqual([text, []]);
    }
    expect(rules("Call 211 for help")).toEqual(["phone_number"]);
    expect(rules("marca el 311")).toEqual(["phone_number"]);
  });

  it("flags claim and tone words as whole words only", () => {
    expect(rules("This will cure it")).toEqual(["banned_word"]);
    expect(rules("Te lo garantizamos")).toEqual(["banned_word"]);
    expect(rules("your cancer journey")).toEqual(["banned_word"]);
    expect(rules("Procura descansar. Make sure you're secure.")).toEqual([]);
  });

  it("recognises the AI processor name as a whole word, any case", () => {
    expect(AI_PROCESSOR_NAME.test("your question is sent to OpenAI")).toBe(true);
    expect(AI_PROCESSOR_NAME.test("se envía a openai")).toBe(true);
    expect(AI_PROCESSOR_NAME.test("an open AI model")).toBe(false);
  });

  it("does not flag ordinary small numbers", () => {
    expect(rules("Pack 2 or 3 changes of clothes. Kept for 30 days.")).toEqual([]);
  });
});
