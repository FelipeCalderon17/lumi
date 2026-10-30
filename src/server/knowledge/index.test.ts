import { describe, expect, it } from "vitest";
import { ArticleFrontmatterSchema } from "./index";

const valid = {
  id: "parking-and-meals",
  lang: "en",
  title: "Parking and meals during a hospital stay",
  category: "hospital-logistics",
  reviewedAt: "2026-10-30",
};

describe("knowledge.ArticleFrontmatterSchema (contract)", () => {
  it("accepts valid frontmatter", () => {
    expect(ArticleFrontmatterSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects ids that are not kebab-case and non-ISO dates", () => {
    expect(ArticleFrontmatterSchema.safeParse({ ...valid, id: "Parking Meals" }).success).toBe(
      false,
    );
    expect(ArticleFrontmatterSchema.safeParse({ ...valid, reviewedAt: "30/10/2026" }).success).toBe(
      false,
    );
  });

  it.todo("assigns stable handles sorted by id");
  it.todo("every EN article has an ES article with the same id (parity)");
});
