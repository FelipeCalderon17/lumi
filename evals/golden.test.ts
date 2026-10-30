import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GoldenCaseSchema } from "./golden";

describe("evals/golden.jsonl", () => {
  const lines = readFileSync(new URL("./golden.jsonl", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "");

  it("every line is a valid golden case with a unique id", () => {
    const ids = lines.map((line) => GoldenCaseSchema.parse(JSON.parse(line)).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
