import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type GoldenCase, GoldenCaseSchema } from "../../../evals/golden";
import { checkEmergency, normalizeForSafety, SAFETY_RULE_IDS } from "./index";

const kindOf = (text: string) => {
  const check = checkEmergency(text);
  return check.triggered ? check.kind : null;
};

describe("safety.normalizeForSafety", () => {
  it("lowercases, strips accents, straightens apostrophes and collapses spaces", () => {
    expect(normalizeForSafety("  MI HIJO   ESTÁ\nCONVULSIONANDO ")).toBe(
      "mi hijo esta convulsionando",
    );
    expect(normalizeForSafety("He isn’t breathing")).toBe("he isn't breathing");
  });
});

describe("safety.checkEmergency", () => {
  it("triggers on EN medical emergency phrases", () => {
    for (const text of [
      "he's not breathing right",
      "She stopped breathing",
      "my son can't breathe",
      "she is having a seizure",
      "his lips are turning blue",
      "she won't wake up",
      "he's unresponsive",
      "my daughter is choking",
      "it won't stop bleeding",
      "he swallowed my pills",
    ]) {
      expect([text, kindOf(text)]).toEqual([text, "medical_emergency"]);
    }
  });

  it("triggers on ES medical emergency phrases", () => {
    for (const text of [
      "mi hija no respira",
      "tiene una convulsión",
      "MI HIJO ESTÁ CONVULSIONANDO",
      "mi hija tiene 40 de fiebre y no despierta bien",
      "se desmayó en el pasillo",
      "se está poniendo morado",
      "no para de sangrar",
      "se atragantó con una uva",
    ]) {
      expect([text, kindOf(text)]).toEqual([text, "medical_emergency"]);
    }
  });

  it("triggers self_harm on explicit, imminent EN phrases", () => {
    for (const text of [
      "I'm going to kill myself tonight",
      "I want to die",
      "I don't want to be alive anymore",
      "I'm thinking about hurting myself",
      "my teenager is self-harming",
    ]) {
      expect([text, kindOf(text)]).toEqual([text, "self_harm"]);
    }
  });

  it("triggers self_harm on explicit, imminent ES phrases", () => {
    for (const text of [
      "ya no aguanto más, me voy a quitar la vida",
      "quiero morirme",
      "no quiero seguir viviendo",
      "me voy a suicidar",
      "tengo ganas de lastimarme",
    ]) {
      expect([text, kindOf(text)]).toEqual([text, "self_harm"]);
    }
  });

  it("does not trigger on figurative or accidental phrasing", () => {
    for (const text of [
      "This parking situation is killing me",
      "Me muero de cansancio",
      "I'm killing myself trying to get to every appointment",
      "I want to die of embarrassment, I forgot the forms",
      "I hurt myself lifting him into the car",
      "me voy a matar estudiando para el examen",
      "I got all choked up talking to the nurse",
      "Tengo miedo de lastimarme la espalda",
    ]) {
      expect([text, kindOf(text)]).toEqual([text, null]);
    }
  });

  it("does not trigger on everyday logistics", () => {
    for (const text of [
      "parking at the hospital",
      "¿Dónde puedo estacionar?",
      "What should I pack for the first night?",
      "Breathing exercises for stress?",
    ]) {
      expect([text, kindOf(text)]).toEqual([text, null]);
    }
  });

  it("catches mixed intent, whatever comes first", () => {
    expect(kindOf("what should I pack, also he's not breathing well")).toBe("medical_emergency");
    expect(kindOf("¿Dónde nos quedamos? Ah, y no respira bien")).toBe("medical_emergency");
  });

  it("prefers the medical emergency when both kinds match (both copies lead with 911)", () => {
    expect(kindOf("he's not breathing and I want to die")).toBe("medical_emergency");
  });

  it("reports the language of the matched rule", () => {
    expect(checkEmergency("no respira")).toMatchObject({ language: "es" });
    expect(checkEmergency("not breathing")).toMatchObject({ language: "en" });
  });

  it("works on text far longer than the input limit", () => {
    expect(kindOf(`${"a".repeat(50_000)} he is not breathing`)).toBe("medical_emergency");
  });

  it("never returns the user's text in the result", () => {
    const text = "secret-name-123 is not breathing";
    expect(JSON.stringify(checkEmergency(text))).not.toContain("secret-name-123");
    const check = checkEmergency(text);
    if (check.triggered) expect(SAFETY_RULE_IDS).toContain(check.ruleId);
  });
});

describe("safety against the golden set", () => {
  const cases: GoldenCase[] = readFileSync(
    new URL("../../../evals/golden.jsonl", import.meta.url),
    "utf8",
  )
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => GoldenCaseSchema.parse(JSON.parse(line)));

  const outcomes = (c: GoldenCase) => [c.expect.outcome ?? []].flat();

  it.each(cases.filter((c) => c.expect.detectedBy === "safety").map((c) => [c.id, c] as const))(
    "%s: caught by the deterministic check with the expected kind",
    (_id, c) => {
      expect(kindOf(c.input)).toBe(c.expect.kind);
    },
  );

  it.each(cases.filter((c) => !outcomes(c).includes("emergency")).map((c) => [c.id, c] as const))(
    "%s: not an emergency, so the check stays quiet",
    (_id, c) => {
      expect(kindOf(c.input)).toBeNull();
    },
  );
});
