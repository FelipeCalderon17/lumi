/**
 * Volunteer opportunities (MOCK, labelled demo). Facets live here; the copy for each one lives
 * in the dictionaries under `volunteer.opportunities.<id>`.
 */

export const COMMITMENTS = ["one_off", "monthly", "weekly"] as const;
export type Commitment = (typeof COMMITMENTS)[number];

export const MODES = ["in_person", "remote"] as const;
export type Mode = (typeof MODES)[number];

export const SKILLS = ["driving", "cooking", "kids", "languages", "events", "office"] as const;
export type Skill = (typeof SKILLS)[number];

export type Opportunity = {
  id: "drive" | "meals" | "playroom" | "translate" | "events" | "admin";
  commitment: Commitment;
  modes: readonly Mode[];
  skills: readonly Skill[];
};

export const OPPORTUNITIES: readonly Opportunity[] = [
  { id: "drive", commitment: "weekly", modes: ["in_person"], skills: ["driving"] },
  { id: "meals", commitment: "monthly", modes: ["in_person"], skills: ["cooking"] },
  { id: "playroom", commitment: "weekly", modes: ["in_person"], skills: ["kids"] },
  { id: "translate", commitment: "monthly", modes: ["remote", "in_person"], skills: ["languages"] },
  { id: "events", commitment: "one_off", modes: ["in_person"], skills: ["events", "kids"] },
  { id: "admin", commitment: "monthly", modes: ["remote"], skills: ["office"] },
];

export type VolunteerFilters = {
  commitment: Commitment | "any";
  mode: Mode | "any";
  /** Empty = any skill. Otherwise an opportunity matches if it uses ANY of the chosen skills. */
  skills: readonly Skill[];
};

export const NO_FILTERS: VolunteerFilters = { commitment: "any", mode: "any", skills: [] };

export function filterOpportunities(
  list: readonly Opportunity[],
  filters: VolunteerFilters,
): Opportunity[] {
  return list.filter(
    (o) =>
      (filters.commitment === "any" || o.commitment === filters.commitment) &&
      (filters.mode === "any" || o.modes.includes(filters.mode)) &&
      (filters.skills.length === 0 || filters.skills.some((s) => o.skills.includes(s))),
  );
}

/** Demo sign-up validation. Returns the fields with a problem (empty = valid). */
export type SignupForm = { name: string; email: string; opportunity: string; consent: boolean };
export type SignupErrors = Partial<Record<keyof SignupForm, "required" | "invalid">>;

export function validateSignup(form: SignupForm): SignupErrors {
  const errors: SignupErrors = {};
  if (form.name.trim() === "") errors.name = "required";
  if (form.email.trim() === "") errors.email = "required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = "invalid";
  if (form.opportunity === "") errors.opportunity = "required";
  if (!form.consent) errors.consent = "required";
  return errors;
}
