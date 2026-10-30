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
    expect(normalizeForSafety("¡¡No... está respirando!!")).toBe("no esta respirando");
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

  it("catches the misses reproduced in Codex review 3", () => {
    expect(kindOf("No está respirando")).toBe("medical_emergency");
    expect(kindOf("No puedo despertarlo")).toBe("medical_emergency");
    expect(kindOf("Me voy a hacer daño")).toBe("self_harm");
    expect(kindOf("I wanna die")).toBe("self_harm");
  });

  it("covers ordinary ES grammar: 1st/3rd person, present continuous, clitics", () => {
    for (const [text, kind] of [
      ["no está respirando", "medical_emergency"],
      ["no estoy respirando bien", "medical_emergency"],
      ["no puedo respirar", "medical_emergency"],
      ["no respiro", "medical_emergency"],
      ["ha dejado de respirar", "medical_emergency"],
      ["no puedo despertarla", "medical_emergency"],
      ["no logramos despertarlo", "medical_emergency"],
      ["se está desmayando", "medical_emergency"],
      ["se está atragantando", "medical_emergency"],
      ["está sangrando mucho", "medical_emergency"],
      ["me quiero morir", "self_harm"],
      ["quiero morirme", "self_harm"],
      ["se quiere morir", "self_harm"],
      ["me quiero hacer daño", "self_harm"],
      ["se va a hacer daño", "self_harm"],
      ["me quiero matar", "self_harm"],
      ["ya no quiero vivir", "self_harm"],
    ] as const) {
      expect([text, kindOf(text)]).toEqual([text, kind]);
    }
  });

  it("covers EN contractions and slang", () => {
    for (const [text, kind] of [
      ["he isn't breathing", "medical_emergency"],
      ["he isnt breathing", "medical_emergency"],
      ["she stopped breathing", "medical_emergency"],
      ["I can't wake him up", "medical_emergency"],
      ["cant wake her up!!", "medical_emergency"],
      ["he doesn't wake up", "medical_emergency"],
      ["I'm gonna hurt myself", "self_harm"],
      ["i wanna hurt myself", "self_harm"],
      ["I just want to die", "self_harm"],
      ["i dont wanna live anymore", "self_harm"],
    ] as const) {
      expect([text, kindOf(text)]).toEqual([text, kind]);
    }
  });

  it("accented and unaccented, any case and punctuation, give the same result", () => {
    for (const text of [
      "NO ESTÁ RESPIRANDO",
      "no esta respirando",
      "¡¡No... está respirando!!",
      "No-está-respirando",
    ]) {
      expect([text, kindOf(text)]).toEqual([text, "medical_emergency"]);
    }
    expect(kindOf("ME QUIERO HACER DAÑO")).toBe("self_harm");
    expect(kindOf("me quiero hacer dano")).toBe("self_harm");
  });

  it("poisoning: overdose, accidental ingestion and hazardous substances trigger", () => {
    for (const text of [
      "he took too many pills",
      "she swallowed too much of the syrup",
      "my son took an overdose",
      "he accidentally swallowed my pills",
      "she took her pills by accident, twice",
      "he got into the medicine cabinet",
      "she swallowed the whole bottle",
      "he drank bleach",
      "my toddler swallowed a battery",
      "she ate some laundry pods",
      "sobredosis",
      "se tomó todas las pastillas",
      "se tomó todas",
      "se tomó el frasco entero",
      "se tomó las pastillas por accidente",
      "le di demasiadas pastillas",
      "se tragó una pila",
      "se tomó cloro",
      "se tomó mis pastillas",
    ]) {
      expect([text, kindOf(text)]).toEqual([text, "medical_emergency"]);
    }
  });

  it("poisoning: routine medication administration does NOT trigger", () => {
    for (const text of [
      "He swallowed his medicine as prescribed",
      "Le di su medicina como indicó el médico",
      "tomó sus pastillas",
      "she took her pills after dinner",
      "he swallowed the tablet with water, no problem",
      "se tomó el jarabe sin quejarse",
      "He takes too many medications, I can't keep track of them",
      "she drank the whole bottle of water",
      "tomó las pastillas de su tratamiento",
    ]) {
      expect([text, kindOf(text)]).toEqual([text, null]);
    }
  });

  it("ES 'me voy a cortar el pelo' and similar are not self-harm", () => {
    for (const text of [
      "me voy a cortar el pelo antes de la quimio",
      "quiero cortarme el pelo corto",
      "me voy a lastimar la espalda si lo sigo cargando",
    ]) {
      expect([text, kindOf(text)]).toEqual([text, null]);
    }
  });

  it("catches mixed intent, whatever comes first", () => {
    expect(kindOf("what should I pack, also he's not breathing well")).toBe("medical_emergency");
    expect(kindOf("¿Dónde nos quedamos? Ah, y no respira bien")).toBe("medical_emergency");
    expect(kindOf("Where do I park? Also I wanna die")).toBe("self_harm");
    expect(kindOf("¿Cuánto cuesta el parqueo? No puedo despertarlo")).toBe("medical_emergency");
    expect(kindOf("Le di su medicina como indicó el médico, pero ahora no respira")).toBe(
      "medical_emergency",
    );
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
