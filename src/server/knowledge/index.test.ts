import { describe, expect, it } from "vitest";
import { ArticleFrontmatterSchema } from "./index";

const valid = {
  id: "first-days-at-the-hospital",
  lang: "en",
  title: "Your first days at the hospital: what to bring",
  category: "hospital-logistics",
  risk: "standard",
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

  it("requires a risk level and rejects unknown keys", () => {
    const { risk: _risk, ...withoutRisk } = valid;
    expect(ArticleFrontmatterSchema.safeParse(withoutRisk).success).toBe(false);
    expect(ArticleFrontmatterSchema.safeParse({ ...valid, risk: "medium" }).success).toBe(false);
    expect(ArticleFrontmatterSchema.safeParse({ ...valid, author: "x" }).success).toBe(false);
  });

  it.todo("assigns stable handles sorted by id");
});
