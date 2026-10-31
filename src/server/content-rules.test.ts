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

  it("regression (Codex re-review 3): fail closed on every dose the gate let through", () => {
    for (const text of [
      "Dale una tableta [1].",
      "Dale una tableta de paracetamol [1].",
      "Dale una tableta cada ocho horas [1].",
      "Give a tablet [1].",
      "Give twenty milligrams [1].",
      "Dale veinte miligramos [1].",
      "Dale una unidad [1].",
      "Give 1 g [1].",
      "Take medicine twice a week [1].",
      "Dale el medicamento cada 30 minutos [1].",
    ]) {
      expect([text, rules(text).includes("dosage")]).toEqual([text, true]);
    }
  });

  it("dosage layer 1: any quantity form next to a dose unit or form", () => {
    for (const text of [
      "1/2 tablet",
      "½ tableta",
      "2.5 ml",
      "2,5 ml",
      "twenty-five milligrams",
      "fifty ml",
      "veinticinco miligramos",
      "cien microgramos",
      "a quarter tablet",
      "un cuarto de pastilla",
      "una cucharadita",
      "un gramo",
      "3 g",
      "mg per kg", // an unambiguous dose unit on its own
      "dosis en ml",
    ]) {
      expect([text, rules(text).includes("dosage")]).toEqual([text, true]);
    }
  });

  it("dosage layer 2: any frequency next to something being dosed", () => {
    for (const text of [
      "Give the medicine every 30 minutes",
      "the pills every other day",
      "jarabe tres veces por semana",
      "las pastillas cada dos días",
      "his meds three times weekly",
      "medicine once a month",
      "dale ibuprofeno cada seis horas",
    ]) {
      expect([text, rules(text).includes("dosage")]).toEqual([text, true]);
    }
  });

  it("dosage layer 3: a medicine word within a few words of any quantity", () => {
    for (const text of [
      "Give the medicine, 5 [1]",
      "Dale la medicina, dos [1]",
      "Give paracetamol 3 times [1]",
      "acetaminophen: half [1]",
      "ask about the medicine at 8:00 [1]",
      "2 of the pills [1]",
    ]) {
      expect([text, rules(text)]).toEqual([text, ["dosage"]]);
    }
  });

  it("a tablet is the device only when the sentence says so, and never with a number before it", () => {
    for (const text of [
      "Bring a tablet (iPad) [1].",
      "Trae una tableta para juegos y videos [1].",
      "Trae una tableta con películas [1].",
      "Things to do: books, coloring, a tablet with headphones, a small game.",
      "Cosas para entretenerse: libros, una tableta con audífonos, un juego pequeño.",
    ]) {
      expect([text, rules(text)]).toEqual([text, []]);
    }
    expect(rules("Bring a tablet [1].")).toEqual(["dosage"]);
    expect(rules("Bring a tablet with headphones and 2 tablets of syrup")).toContain("dosage");
  });

  it("fail-closed counterexamples that still pass", () => {
    for (const text of [
      "take 2 snacks",
      "Go to room 211 [1].",
      "Take a break every 2 hours [1].",
      "Toma un descanso cada 2 horas [1].",
      "Bring your medicines list [1].",
      "Your own medicines, if you take any [1].",
      "Bring a pill organizer [1].",
      "Once you arrive, give the nurse your medication list [1].",
      "la unidad de oncología está en el piso 3 [1]",
      "Si toma demasiada medicina, llama al 911 [1].",
    ]) {
      expect([text, rules(text)]).toEqual([text, []]);
    }
  });

  it("documented fail-closed false positive: a medicine word in the same sentence as a frequency", () => {
    expect(rules("Write down your medicine list and take a break every 2 hours [1].")).toEqual([
      "dosage",
    ]);
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
