import { describe, expect, it } from "vitest";
import { fill } from "./format";

describe("fill", () => {
  it("replaces known placeholders and leaves unknown ones", () => {
    expect(fill("{n} of {max}", { n: 3, max: 800 })).toBe("3 of 800");
    expect(fill("Hi {name}", {})).toBe("Hi {name}");
  });
});
