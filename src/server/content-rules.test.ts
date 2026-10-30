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
    expect(rules("every 4 hours")).toEqual(["dosage"]);
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
