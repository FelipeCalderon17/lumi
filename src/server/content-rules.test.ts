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

  const withheld = (text: string) => rules(text).includes("dosage");

  it("flags dosages and dosing frequencies in EN and ES", () => {
    for (const text of [
      "Give 5 ml",
      "200mg twice",
      "dale 2,5 ml cada 6 horas",
      "give it every 4 hours",
      "Give the syrup twice a day",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("regression (Codex review 3): spelled-out units, written quantities, frequency with dose", () => {
    for (const text of [
      "Give 5 milligrams twice daily [1]",
      "Dale 5 miligramos cada mañana [1]",
      "Give one tablet [1]",
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
      expect([text, withheld(text)]).toEqual([text, true]);
    }
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
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("regression (Codex re-review 4): structural rules, no drug names, no device masking", () => {
    for (const text of [
      "Give a tablet for pain while watching cartoons",
      "Dale una tableta antes de ver películas",
      "Give half a tablet with headphones",
      "Give a gram",
      "Take a teaspoon",
      "Take insulin twice daily",
      "Take morphine every four hours",
      "Take amoxicillin every 8 hours",
      "Take medicine\nevery 8 hours",
      "Take paracetamol. Every 8 hours",
      "Give 5 international units",
      "Dale once pastillas",
      "Take medication once",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("rule 1: an administration verb followed by any quantity, within the window", () => {
    for (const text of [
      "Give the medicine, 5 [1]",
      "Dale la medicina, dos [1]",
      "Give paracetamol 3 times [1]",
      "Administer -5 [1]",
      "Aplícale media [1]",
      "Inyecta veinticinco [1]",
      "Usa 3 [1]",
      "Take the syrup.\nYou can use 2 [1]",
      "Toma el jarabe. Luego, en la noche, tres [1]",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("rule 2: an administration verb with any frequency, after it or (same sentence) before it", () => {
    for (const text of [
      "Give the medicine every 30 minutes",
      "dale ibuprofeno cada seis horas",
      "Toma la medicina diariamente",
      "Dale el jarabe al día",
      "Give it nightly",
      "Every 8 hours, give it",
      "Cada mañana, dale el jarabe",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("rule 3: any quantity form directly before a dose unit or form; articles count", () => {
    for (const text of [
      "1/2 tablet",
      "½ tableta",
      "2.5 ml",
      "2,5 ml",
      "-5 ml",
      "twenty-five milligrams",
      "fifty ml",
      "veinticinco miligramos",
      "cien microgramos",
      "a quarter tablet",
      "un cuarto de pastilla",
      "una cucharadita",
      "un gramo",
      "a gram",
      "a teaspoon",
      "3 g",
      "5 international units",
      "10 UI",
      "once pastillas",
      "2 of the pills",
      "mg per kg", // an unambiguous dose unit on its own
      "dosis en ml",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("rule 4: a dose unit or form with a frequency in the same sentence", () => {
    for (const text of ["the pills every other day", "las pastillas cada dos días"]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("a tablet is the device only in an explicit construction with no verb or number on it", () => {
    for (const text of [
      "Bring a tablet (iPad) [1].",
      "Bring a tablet computer [1].",
      "Trae una tableta electrónica [1].",
      "Trae una tableta para juegos y videos [1].",
      "Trae una tableta con películas [1].",
      "bring a tablet or headphones for the waiting room",
      "Things to do: books, coloring, a tablet with headphones, a small game.",
      "Cosas para entretenerse: libros, cosas para colorear, una tableta con audífonos, un juego pequeño.",
    ]) {
      expect([text, rules(text)]).toEqual([text, []]);
    }
    for (const text of [
      "Bring a tablet [1].",
      "Bring a tablet with headphones and 2 tablets of syrup",
      "Give a tablet with headphones",
      "Bring 2 tablets with headphones",
      "Dale una tableta para juegos",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("harmless objects after take/give, and other counterexamples that pass", () => {
    for (const text of [
      "take 2 snacks",
      "room 211",
      "Go to room 211 [1].",
      "take a break every 2 hours",
      "Take a break every 2 hours [1].",
      "Write down your medicine list and take a break every 2 hours [1].",
      "Toma un descanso cada 2 horas [1].",
      "Toma una siesta cada tarde [1].",
      "dale un abrazo cada mañana",
      "Give them time of their own. Even ten minutes alone with you matters.",
      "Bring your medicines list [1].",
      "Your own medicines, if you take any [1].",
      "Toothbrush, toiletries and anything you use every day.\nYour own medicines, if you take any.",
      "Bring a pill organizer [1].",
      "Once you arrive, give the nurse your medication list [1].",
      "la unidad de oncología está en el piso 3 [1]",
      "Si toma demasiada medicina, llama al 911 [1].",
      "Visiting hours are twice a day",
      "every 4 hours",
      "Está en la habitación 311",
    ]) {
      expect([text, rules(text)]).toEqual([text, []]);
    }
    expect(rules("Call 211 for help")).toEqual(["phone_number"]);
    expect(rules("marca el 311")).toEqual(["phone_number"]);
  });

  it("known gaps (no verb, no unit, no form): listed so a change is visible", () => {
    // Rare phrasings go to the golden set / evals, not to more patterns (Felipe, re-review 4).
    for (const text of ["acetaminophen: half [1]", "his meds three times weekly"]) {
      expect([text, rules(text)]).toEqual([text, []]);
    }
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
