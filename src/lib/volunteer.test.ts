import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { es } from "@/i18n/dictionaries/es";
import { filterOpportunities, NO_FILTERS, OPPORTUNITIES, validateSignup } from "./volunteer";

const ids = (filters: Parameters<typeof filterOpportunities>[1]) =>
  filterOpportunities(OPPORTUNITIES, filters).map((o) => o.id);

describe("filterOpportunities", () => {
  it("no filters shows everything", () => {
    expect(ids(NO_FILTERS)).toHaveLength(OPPORTUNITIES.length);
  });

  it("filters by time commitment", () => {
    expect(ids({ ...NO_FILTERS, commitment: "one_off" })).toEqual(["events"]);
    expect(ids({ ...NO_FILTERS, commitment: "weekly" })).toEqual(["drive", "playroom"]);
  });

  it("filters by remote / in person (an opportunity can be both)", () => {
    expect(ids({ ...NO_FILTERS, mode: "remote" })).toEqual(["translate", "admin"]);
    expect(ids({ ...NO_FILTERS, mode: "in_person" })).not.toContain("admin");
  });

  it("matches ANY chosen skill", () => {
    expect(ids({ ...NO_FILTERS, skills: ["kids"] })).toEqual(["playroom", "events"]);
    expect(ids({ ...NO_FILTERS, skills: ["driving", "office"] })).toEqual(["drive", "admin"]);
  });

  it("combines facets with AND, and can return nothing", () => {
    expect(ids({ commitment: "monthly", mode: "remote", skills: ["languages"] })).toEqual([
      "translate",
    ]);
    expect(ids({ commitment: "one_off", mode: "remote", skills: [] })).toEqual([]);
  });

  it("every opportunity has copy in both languages", () => {
    for (const o of OPPORTUNITIES) {
      expect(en.volunteer.opportunities[o.id].title).toBeTruthy();
      expect(es.volunteer.opportunities[o.id].title).toBeTruthy();
    }
  });
});

describe("validateSignup", () => {
  const ok = { name: "Sam", email: "sam@example.com", opportunity: "meals", consent: true };

  it("accepts a complete form", () => {
    expect(validateSignup(ok)).toEqual({});
  });

  it("flags missing and invalid fields", () => {
    expect(validateSignup({ name: " ", email: "", opportunity: "", consent: false })).toEqual({
      name: "required",
      email: "required",
      opportunity: "required",
      consent: "required",
    });
    expect(validateSignup({ ...ok, email: "sam@example" })).toEqual({ email: "invalid" });
  });
});
