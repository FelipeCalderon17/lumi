import { describe, expect, it } from "vitest";
import { hasQuantityLike } from "./quantity-like";

const each = (texts: readonly string[], expected: boolean) => {
  for (const text of texts) expect([text, hasQuantityLike(text)]).toEqual([text, expected]);
};

describe("notebook.hasQuantityLike (broad on purpose: a hit quotes the parent's note)", () => {
  it("any digit, in any script, with superscripts and vulgar fractions", () => {
    each(["Gave 2", "Temp ５ °C", "mg/m²", "x²", "½ tablet", "B12", "8:30", "Ⅻ", "5️⃣"], true);
  });

  it("written numbers EN/ES, including once, dozen, cuarto, medio/media, half, ordinals", () => {
    each(
      [
        "woke up once",
        "slept a dozen hours",
        "durmió un cuarto de hora",
        "half her dinner",
        "media pastilla",
        "medio vaso",
        "twice",
        "seventy",
        "veintitrés",
        "doscientos",
        "the second night",
        "la primera vez",
        "a couple of times",
        "la mitad",
        "Once",
      ],
      true,
    );
  });

  it("signs and minus symbols, separated or attached, and fraction or ratio symbols", () => {
    each(
      [
        "Temperature − five",
        "minus: -five",
        "+five",
        "± a bit",
        "Gave - more",
        "a – b",
        "1⁄2",
        "ratio 1∶2",
        "and/or",
        "a 50% chance",
        "fever ° high",
      ],
      true,
    );
  });

  it("units, dose forms and measures, alone or after an article", () => {
    each(
      [
        "Gave an international unit",
        "Gave constructor units",
        "Gave a spoon",
        "Gave dollops",
        "un sobre",
        "Gave a tablet",
        "Le di un miligramo",
        "an hour",
        "all day",
        "una hora",
        "some drops",
        "a vial",
        "fl oz",
        "degrees",
        "Gave a dollop of syrup",
        "un poco de sopa",
      ],
      true,
    );
  });

  it("plain observations without any of that pass, so the model's rephrasing is kept", () => {
    each(
      [
        "Slept badly and woke up in the night.",
        "She was very tired after school.",
        "You wondered whether the new medicine made her tired.",
        "Is it OK that she didn't finish dinner?",
        "Durmió mal y se despertó llorando.",
        "Habló sobre la escuela.", // ES "sobre" = about, without an article
        "A follow-up visit felt well-organised.", // hyphens inside words aren't signs
        "Medicines given",
      ],
      false,
    );
  });
});
