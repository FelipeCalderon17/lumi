import { describe, expect, it } from "vitest";
import { AI_PROCESSOR_NAME, findContentViolations, normalizeForDosage } from "./content-rules";

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

  it("regression (Codex re-review 5): every verbless and schedule example is withheld", () => {
    for (const text of [
      "acetaminophen: half",
      "his meds three times weekly",
      "Paracetamol 500 every 6 hours",
      "Morphine — 5 — twice daily",
      "Medication: half",
      "Tablets: half",
      "Capsules.\nTwice daily",
      "Take medicine at bedtime",
      "Toma el medicamento por la mañana",
      "Use insulin daily",
      "Usa insulina diariamente",
      "q6h",
      // The rest of the reviewer's probes.
      "Medicamento: media [1].",
      "Medicine — 5 — twice daily [1].",
      "medicinas: dos veces por semana [1].",
      "The medicine.\nThree times weekly [1].",
      "Medications:\n- half\n- twice daily [1].",
      "Paracetamol\n500\nevery 6 hours [1].",
      "Las pastillas: media [1].",
      "Pills — 5 — twice daily [1].",
      "The tablet with headphones: half [1].",
      "Take a break, then swallow medication daily [1].",
      "Swallow medicine three times daily [1].",
      "Take medication in the morning [1].",
      "Toma medicina por las noches [1].",
      "Tómese la medicina diariamente [1].",
      "Take medicine every eight hours [1].",
      "Take medicine 3x/day [1].",
      "Medicine q6h [1].",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("backstop a: medication context + quantity, frequency or schedule, no verb needed", () => {
    for (const text of [
      "his meds, 2",
      "the prescription twice a week",
      "el remedio cada 8 horas",
      "el jarabe con las comidas",
      "drops before bed",
      "Syrup: after meals",
      "the patch every 3 days",
      "Twice daily.\nCapsules.", // a bare fragment before the medication word
      "Medicine. Do it twice daily.", // after it, across a sentence break, within the window
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("backstop b: a quantity + a frequency, no medication word needed", () => {
    for (const text of [
      "500 every 6 hours",
      "5 — twice daily",
      "half, then three times weekly",
      "2 bid",
      "Every 6 hours: 500",
      "10, once a day",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("backstop c: label or list fragments", () => {
    for (const text of [
      "acetaminophen: half",
      "Acetaminophen, half.",
      "Ibuprofen – 1 and a half",
      "Tylenol - 5",
      "Paracetamol every 6 hours.",
      "Children's Tylenol twice daily.",
      "Amoxicillin at bedtime.",
      "Paracetamol: every 6 hours",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("schedules after an administration verb, after it or before it in the sentence", () => {
    for (const text of [
      "Give it at bedtime",
      "Dale el jarabe antes de dormir",
      "Toma la pastilla en ayunas",
      "At bedtime, give it.",
      "Por la noche, dale el jarabe.",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("clinical frequency abbreviations: q-forms, tid and qid alone; bid with anything else", () => {
    for (const text of ["q6h", "q8h", "qd", "qid", "tid", "qhs", "Medicine bid", "1 bid"]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("use/usa: withheld with an object before the frequency; KB relative clauses pass", () => {
    for (const text of ["Use insulin daily", "Use it twice a day", "Usa la crema por la noche"]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
    for (const text of [
      "anything you use every day",
      "lo que uses a diario",
      "Usa lo que de verdad vayas a mantener al día.",
      "Lumi uses the guides in this library. A linked guide may not support every statement.",
    ]) {
      expect([text, rules(text)]).toEqual([text, []]);
    }
  });

  it("counterexamples from the brief pass: no quantity, frequency or schedule with the medicine", () => {
    for (const text of [
      "take 2 snacks",
      "room 211",
      "take a break every 2 hours",
      "bring a tablet with headphones",
      "write down your medicine list",
      "bring the list of medicines your care team gave you",
      "If you're ever unsure about a medicine, how much to give or when, call your care team.",
      "In an emergency, 911.",
      "Pack 2 or 3 changes of clothes. Kept for 30 days.",
    ]) {
      expect([text, rules(text)]).toEqual([text, []]);
    }
  });

  it("regression (Codex re-review 6, F1): a label value counts whatever follows it", () => {
    for (const text of [
      "Paracetamol: half as needed",
      "Paracetamol: media si lo necesita",
      "Morphine: ½ as needed",
      "Paracetamol: half for pain",
      "Paracetamol: half, then rest",
      "Paracetamol — half. Rest afterward",
      "Paracetamol: 500 when needed",
      "Paracetamol: 500 si hace falta",
      "Acetaminophen, half if needed", // comma: a bare run, then a condition
      "Paracetamol at night if needed", // no separator: a timed run, then a condition
      "Paracetamol por la mañana si lo necesita",
      "Acetaminophen: one third",
      "Acetaminophen: a third",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
  });

  it("regression (Codex re-review 6, F1): list lines under a heading are one scope", () => {
    for (const text of [
      "Paracetamol\n- half\n- at bedtime",
      "Paracetamol\n• half\n• at bedtime",
      "Paracetamol\n1. half\n2. at bedtime",
      "ibuprofeno\nmedia\npor la noche",
      "Paracetamol\nHalf as needed",
      "Paracetamol\n500\nMorning and night",
      "Here is what the care team wrote about it:\n- a note\n- half at bedtime",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
    // The scope is bounded: a value more than LIST_SCOPE_LINES lines under the heading, or after
    // a line that's neither a list item nor bare, isn't in it.
    for (const text of [
      "Paracetamol\n- a\n- b\n- c\n- d\n- half",
      "Paracetamol\nThat's a long name to spell, so take your time with it.\nHalf of us forget",
    ]) {
      expect([text, rules(text)]).toEqual([text, []]);
    }
  });

  it("regression (Codex re-review 6, F2): use/usa with a schedule before, or after a relative", () => {
    for (const text of [
      "At bedtime, use it",
      "Al acostarse, usa eso",
      "Daily, use insulin",
      "Use what was prescribed at bedtime",
      "Usa lo que te recetaron por la noche",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
    // A frequency inside the relative clause is still the inner verb's (KB lines).
    for (const text of [
      "Toothbrush, toiletries and anything you use every day.",
      "Cepillo de dientes, artículos de aseo y lo que uses a diario.",
      "Usa lo que de verdad vayas a mantener al día.",
    ]) {
      expect([text, rules(text)]).toEqual([text, []]);
    }
  });

  it("regression (Codex re-review 6, F3): any Unicode decimal digit is read as ASCII", () => {
    expect(normalizeForDosage("٢ ２ ۵ ५ 𝟚 ½")).toBe("2 2 5 5 2 1/2");
    expect(normalizeForDosage("b.i.d. t. i. d. q.d. p.r.n.")).toBe("bid tid qd prn");
    for (const text of [
      "Give ٢",
      "Medication: ２",
      "Give ५ ml",
      "Dale ۲ pastillas",
      "Give 5 ｍｇ",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
    expect(rules("Call ٩١١ now.")).toEqual([]); // still the service number
  });

  it("regression (Codex re-review 6, F7): multiples, fractions, meal and plural schedules, dotted abbreviations", () => {
    for (const text of [
      "Give double",
      "Dose: double",
      "Double the dose",
      "Take a third",
      "Tómate un tercio",
      "Toma la mitad",
      "Take after breakfast",
      "Take in the mornings",
      "Insulin in the mornings",
      "Toma al despertar",
      "Medicine — morning and night",
      "Medicina: mañana y noche",
      "Paracetamol b.i.d.",
      "Morphine 3x/day",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
    for (const text of ["Take the elevator to the third floor.", "Take a walk after breakfast."]) {
      expect([text, rules(text)]).toEqual([text, []]);
    }
  });

  it("known limitations and accepted over-withholding (EVALS.md, Tracked limitations)", () => {
    // Still pass: vocabulary the finite detector doesn't cover.
    for (const text of ["Paracetamol half", "Give II", "Give Ⅱ", "Take a break, then 5"]) {
      expect([text, withheld(text)]).toEqual([text, false]);
    }
    // Withheld although harmless: the price of failing closed.
    for (const text of [
      "Note: one thing to remember.",
      "Room: 211",
      "Floor: 3",
      "Bring:\n- 2 changes of clothes",
      "She drops him off every morning",
      "Use the bathroom every 2 hours",
    ]) {
      expect([text, withheld(text)]).toEqual([text, true]);
    }
    expect(rules("Room: 211")).toContain("phone_number");
    expect(rules("Room 211")).toEqual([]);
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
