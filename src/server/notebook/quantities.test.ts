import { describe, expect, it } from "vitest";
import { quantitiesIn } from "./quantities";

describe("notebook.quantitiesIn", () => {
  it("reads digits, decimals, fractions and clock times with their canonical unit", () => {
    expect(quantitiesIn("38,5 °C at 8:30pm, 2.50 ml, 3 veces, 5 mg")).toEqual([
      "38.5|deg_c",
      "8:30|pm",
      "2.5|ml",
      "3|times",
      "5|mg",
    ]);
    expect(quantitiesIn("1/2 tablet, ½ tableta, 1½ tablets")).toEqual([
      "0.5|tablet",
      "0.5|tablet",
      "1.5|tablet",
    ]);
    expect(quantitiesIn("8:30 p.m.")).toEqual(["8:30|pm"]);
  });

  it("reads written numbers EN/ES, halves and 'twice'", () => {
    expect(quantitiesIn("fifty ml")).toEqual(["50|ml"]);
    expect(quantitiesIn("five milliliters")).toEqual(["5|ml"]);
    expect(quantitiesIn("twenty-five mg")).toEqual(["25|mg"]);
    expect(quantitiesIn("one hundred and five mg")).toEqual(["105|mg"]);
    expect(quantitiesIn("treinta y cinco ml")).toEqual(["35|ml"]);
    expect(quantitiesIn("veinticinco miligramos")).toEqual(["25|mg"]);
    expect(quantitiesIn("half a tablet")).toEqual(["0.5|tablet"]);
    expect(quantitiesIn("media pastilla")).toEqual(["0.5|tablet"]);
    expect(quantitiesIn("one and a half tablets")).toEqual(["1.5|tablet"]);
    expect(quantitiesIn("dos y media pastillas")).toEqual(["2.5|tablet"]);
    expect(quantitiesIn("woke up twice")).toEqual(["2|times"]);
    expect(quantitiesIn("despertó dos veces")).toEqual(["2|times"]);
  });

  it("keeps units distinct: °C, °F and bare degrees; compound units whole", () => {
    expect(quantitiesIn("38 °C")).toEqual(["38|deg_c"]);
    expect(quantitiesIn("38 C")).toEqual(["38|deg_c"]);
    expect(quantitiesIn("38 grados centígrados")).toEqual(["38|deg_c"]);
    expect(quantitiesIn("38 °F")).toEqual(["38|deg_f"]);
    expect(quantitiesIn("38 F")).toEqual(["38|deg_f"]);
    expect(quantitiesIn("38°")).toEqual(["38|deg"]);
    expect(quantitiesIn("38 grados")).toEqual(["38|deg"]);
    expect(quantitiesIn("5 mL/kg")).toEqual(["5|ml/kg"]);
    expect(quantitiesIn("5 mg per kg")).toEqual(["5|mg/kg"]);
    expect(quantitiesIn("5 mg/kg/day")).toEqual(["5|mg/kg/day"]);
    expect(quantitiesIn("3 horas por la noche")).toEqual(["3|h"]);
  });

  it("keeps unknown glued units as written; a plain word after a number is no unit", () => {
    expect(quantitiesIn("5mEq")).toEqual(["5|meq"]);
    expect(quantitiesIn("5mmol")).toEqual(["5|mmol"]);
    expect(quantitiesIn("2x")).toEqual(["2|x"]);
    expect(quantitiesIn("room 12 and 7")).toEqual(["12|", "7|"]);
  });

  it("marks what it can't read confidently as raw or code (verbatim-only)", () => {
    expect(quantitiesIn("1,000 mg")).toEqual(["raw|1,000"]);
    expect(quantitiesIn("1.2.3")).toEqual(["raw|1.2.3"]);
    expect(quantitiesIn("5/0")).toEqual(["raw|5/0"]);
    expect(quantitiesIn("x²")).toEqual(["raw|²"]);
    expect(quantitiesIn("B12")).toEqual(["code|b12"]);
  });

  it("finds nothing in text without numbers, and doesn't treat 'once' or articles as numbers", () => {
    expect(quantitiesIn("Tired, ate a little, una siesta")).toEqual([]);
    expect(quantitiesIn("once she was asleep")).toEqual([]);
  });
});
