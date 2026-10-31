"use client";

import { useId, useRef, useState } from "react";
import type { Dictionary } from "@/i18n";
import { fill } from "@/i18n/format";
import {
  COMMITMENTS,
  filterOpportunities,
  MODES,
  NO_FILTERS,
  OPPORTUNITIES,
  type Opportunity,
  type SignupErrors,
  SKILLS,
  type VolunteerFilters,
  validateSignup,
} from "@/lib/volunteer";

const chip = (active: boolean) =>
  `min-h-11 rounded-pill border px-4 text-[0.95rem] transition-colors duration-200 ${
    active
      ? "border-glow bg-glow/12 font-semibold text-text"
      : "border-line text-muted hover:border-glow/60 hover:text-text"
  }`;

/** Volunteer roles (MOCK) with filters, and a demo sign-up that sends nothing. */
export function VolunteerBoard({ t }: { t: Dictionary }) {
  const v = t.volunteer;
  const [filters, setFilters] = useState<VolunteerFilters>(NO_FILTERS);
  const [form, setForm] = useState({
    name: "",
    email: "",
    opportunity: "",
    message: "",
    consent: false,
  });
  const [errors, setErrors] = useState<SignupErrors>({});
  const [doneName, setDoneName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const results = filterOpportunities(OPPORTUNITIES, filters);
  const toggleSkill = (skill: (typeof SKILLS)[number]) =>
    setFilters((f) => ({
      ...f,
      skills: f.skills.includes(skill) ? f.skills.filter((s) => s !== skill) : [...f.skills, skill],
    }));

  const pick = (opportunity: Opportunity["id"]) => {
    setForm((f) => ({ ...f, opportunity }));
    setDoneName(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 300);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateSignup(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    setDoneName(form.name.trim());
    setForm({ name: "", email: "", opportunity: "", message: "", consent: false });
  };

  const errorText = (field: keyof SignupErrors) => {
    const e = errors[field];
    if (!e) return null;
    const text =
      field === "consent"
        ? v.errors.consent
        : e === "invalid"
          ? v.errors.invalid
          : v.errors.required;
    return (
      <p id={`${id}-${field}-error`} className="mt-1.5 text-[0.95rem] text-ember">
        {text}
      </p>
    );
  };
  const describedBy = (field: keyof SignupErrors) =>
    errors[field] ? `${id}-${field}-error` : undefined;

  return (
    <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_24rem] lg:items-start">
      <div className="min-w-0">
        <fieldset className="space-y-5 rounded-soft border border-line bg-surface/60 p-5">
          <legend className="eyebrow px-1">{v.filtersTitle}</legend>
          <fieldset>
            <legend className="mb-2 font-semibold">{v.commitmentLabel}</legend>
            <div className="flex flex-wrap gap-2">
              {(["any", ...COMMITMENTS] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={filters.commitment === c}
                  className={chip(filters.commitment === c)}
                  onClick={() => setFilters((f) => ({ ...f, commitment: c }))}
                >
                  {v.commitments[c]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">{v.modeLabel}</legend>
            <div className="flex flex-wrap gap-2">
              {(["any", ...MODES] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={filters.mode === m}
                  className={chip(filters.mode === m)}
                  onClick={() => setFilters((f) => ({ ...f, mode: m }))}
                >
                  {v.modes[m]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">{v.skillsLabel}</legend>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={filters.skills.includes(s)}
                  className={chip(filters.skills.includes(s))}
                  onClick={() => toggleSkill(s)}
                >
                  {v.skills[s]}
                </button>
              ))}
            </div>
          </fieldset>
        </fieldset>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-muted">
            {results.length === 1 ? v.resultsOne : fill(v.results, { n: results.length })}
          </p>
          {(filters.commitment !== "any" ||
            filters.mode !== "any" ||
            filters.skills.length > 0) && (
            <button type="button" className="link min-h-11" onClick={() => setFilters(NO_FILTERS)}>
              {v.clear}
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <p className="mt-4 rounded-soft border border-dashed border-line p-6 text-muted">
            {v.none}
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {results.map((o) => (
              <li
                key={o.id}
                className="flex flex-col rounded-soft border border-dashed border-line bg-surface/60 p-5"
              >
                <h3 className="text-[1.45rem] leading-snug">{v.opportunities[o.id].title}</h3>
                <p className="mt-2 flex-1 text-muted">{v.opportunities[o.id].body}</p>
                <ul className="mt-4 flex flex-wrap gap-1.5 text-[0.82rem]">
                  <li className="rounded-pill bg-raised px-2.5 py-0.5">
                    {v.commitments[o.commitment]}
                  </li>
                  {o.modes.map((m) => (
                    <li key={m} className="rounded-pill bg-raised px-2.5 py-0.5">
                      {v.modes[m]}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn-quiet mt-5 self-start"
                  onClick={() => pick(o.id)}
                >
                  {v.interested}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="scroll-mt-6 rounded-soft border border-line bg-raised/50 p-5 sm:p-6 lg:sticky lg:top-6">
        {doneName !== null ? (
          <div role="status" className="animate-reveal">
            <h2 className="text-3xl">{fill(v.successTitle, { name: doneName })}</h2>
            <p className="mt-3 text-muted">{v.successBody}</p>
            <button type="button" className="btn-quiet mt-5" onClick={() => setDoneName(null)}>
              {v.again}
            </button>
          </div>
        ) : (
          <form ref={formRef} noValidate onSubmit={submit} className="scroll-mt-6">
            <h2 className="text-3xl">{v.signupTitle}</h2>
            <p className="mt-2 text-[0.98rem] text-muted">{v.signupLede}</p>
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor={`${id}-name`} className="mb-1.5 block font-semibold">
                  {v.name}
                </label>
                <input
                  id={`${id}-name`}
                  ref={nameRef}
                  className="field"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={describedBy("name")}
                />
                {errorText("name")}
              </div>
              <div>
                <label htmlFor={`${id}-email`} className="mb-1.5 block font-semibold">
                  {v.email}
                </label>
                <input
                  id={`${id}-email`}
                  type="email"
                  className="field"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={describedBy("email")}
                />
                {errorText("email")}
              </div>
              <div>
                <label htmlFor={`${id}-opportunity`} className="mb-1.5 block font-semibold">
                  {v.opportunity}
                </label>
                <select
                  id={`${id}-opportunity`}
                  className="field"
                  value={form.opportunity}
                  onChange={(e) => setForm((f) => ({ ...f, opportunity: e.target.value }))}
                  aria-invalid={errors.opportunity ? true : undefined}
                  aria-describedby={describedBy("opportunity")}
                >
                  <option value="">{v.chooseOpportunity}</option>
                  {OPPORTUNITIES.map((o) => (
                    <option key={o.id} value={o.id}>
                      {v.opportunities[o.id].title}
                    </option>
                  ))}
                </select>
                {errorText("opportunity")}
              </div>
              <div>
                <label htmlFor={`${id}-message`} className="mb-1.5 block font-semibold">
                  {v.message}
                </label>
                <textarea
                  id={`${id}-message`}
                  rows={3}
                  className="field resize-y"
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>
              <div>
                <label className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input
                    id={`${id}-consent`}
                    type="checkbox"
                    className="mt-1 size-5 shrink-0 accent-[#f6be4f]"
                    checked={form.consent}
                    onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))}
                    aria-invalid={errors.consent ? true : undefined}
                    aria-describedby={describedBy("consent")}
                  />
                  <span>{v.consent}</span>
                </label>
                {errorText("consent")}
              </div>
            </div>
            <button type="submit" className="btn-lantern mt-6 w-full">
              {v.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
