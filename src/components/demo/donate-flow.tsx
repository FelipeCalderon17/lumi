"use client";

import { useId, useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { fill } from "@/i18n/format";
import { DONATION_PRESETS, impactTierFor, parseCustomAmount } from "@/lib/donate";

type Step = "choose" | "review" | "thanks";

/**
 * Donate (DEMO): amount → illustrative impact from a fixed, reviewed table (no AI) → a review
 * step that collects no card details → thank you. No payment is processed.
 */
export function DonateFlow({ locale, t }: { locale: Locale; t: Dictionary }) {
  const d = t.donate;
  const [step, setStep] = useState<Step>("choose");
  const [monthly, setMonthly] = useState(false);
  const [preset, setPreset] = useState<number | "custom">(50);
  const [custom, setCustom] = useState("");
  const id = useId();

  const customAmount = parseCustomAmount(custom);
  const amount = preset === "custom" ? customAmount : preset;
  const tier = amount === null ? null : impactTierFor(amount);
  const money = (value: number) =>
    new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  const customInvalid = preset === "custom" && custom.trim() !== "" && customAmount === null;

  if (step === "thanks") {
    return (
      <div
        role="status"
        className="animate-reveal mt-10 max-w-xl rounded-soft border border-line bg-surface p-8"
      >
        <div
          aria-hidden="true"
          className="mb-5 size-4 rounded-pill bg-lantern shadow-[0_0_30px_8px_rgb(246_190_79/0.5)]"
        />
        <h2 className="text-4xl">{d.thanksTitle}</h2>
        <p className="mt-3 text-muted">{d.thanksBody}</p>
        <button
          type="button"
          className="btn-quiet mt-6"
          onClick={() => {
            setStep("choose");
            setPreset(50);
            setCustom("");
          }}
        >
          {d.again}
        </button>
      </div>
    );
  }

  if (step === "review" && amount !== null) {
    return (
      <div className="animate-reveal mt-10 max-w-xl rounded-soft border border-line bg-surface p-6 sm:p-8">
        <h2 className="text-3xl">{d.checkoutTitle}</h2>
        <p className="mt-4 font-display text-2xl">
          {fill(monthly ? d.summaryMonthly : d.summaryOnce, { amount: money(amount) })}
        </p>
        {monthly && <p className="mt-1 text-muted">{d.monthlyNote}</p>}
        <div className="mt-6 rounded-soft border border-dashed border-glow/60 p-4">
          <p className="font-semibold">{d.checkoutNote}</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-lantern" onClick={() => setStep("thanks")}>
            {d.confirm}
          </button>
          <button type="button" className="btn-quiet" onClick={() => setStep("choose")}>
            {d.edit}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12"
      onSubmit={(event) => {
        event.preventDefault();
        if (amount !== null) setStep("review");
      }}
    >
      <div className="space-y-8">
        <fieldset>
          <legend className="mb-3 font-semibold">{d.frequencyLabel}</legend>
          <div className="inline-flex rounded-pill border border-line p-1">
            {[
              { value: false, label: d.once },
              { value: true, label: d.monthly },
            ].map((option) => (
              <label
                key={String(option.value)}
                className={`flex min-h-11 cursor-pointer items-center rounded-pill px-5 transition-colors duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-glow ${
                  monthly === option.value
                    ? "bg-lantern font-bold text-on-lantern"
                    : "text-muted hover:text-text"
                }`}
              >
                <input
                  type="radio"
                  name={`${id}-freq`}
                  className="sr-only"
                  checked={monthly === option.value}
                  onChange={() => setMonthly(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 font-semibold">{d.amountLabel}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[...DONATION_PRESETS, "custom" as const].map((value) => {
              const active = preset === value;
              return (
                <label
                  key={value}
                  className={`flex min-h-14 cursor-pointer items-center justify-center rounded-soft border font-display text-xl transition-colors duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-glow ${
                    active
                      ? "border-glow bg-glow/12 text-text"
                      : "border-line text-muted hover:border-glow/60 hover:text-text"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${id}-amount`}
                    className="sr-only"
                    checked={active}
                    onChange={() => setPreset(value)}
                  />
                  {value === "custom" ? d.custom : money(value)}
                </label>
              );
            })}
          </div>
          {preset === "custom" && (
            <div className="mt-4">
              <label htmlFor={`${id}-custom`} className="mb-1.5 block">
                {d.customLabel}
              </label>
              <div className="relative max-w-xs">
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 left-4 -translate-y-1/2 text-muted"
                >
                  $
                </span>
                <input
                  id={`${id}-custom`}
                  inputMode="numeric"
                  autoComplete="off"
                  className="field pl-8"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  aria-invalid={customInvalid || undefined}
                  aria-describedby={customInvalid ? `${id}-custom-error` : undefined}
                />
              </div>
              {customInvalid && (
                <p id={`${id}-custom-error`} className="mt-1.5 text-ember">
                  {d.customError}
                </p>
              )}
            </div>
          )}
        </fieldset>

        <button type="submit" className="btn-lantern" disabled={amount === null}>
          {d.continue}
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <aside
        aria-live="polite"
        className="relative self-start overflow-hidden rounded-soft border border-line bg-raised/50 p-6 sm:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-pill bg-lantern/20 blur-3xl"
        />
        <h2 className="text-2xl">{d.impactTitle}</h2>
        {amount !== null && tier !== null ? (
          <>
            <p className="mt-4 font-display text-5xl text-glow">{money(amount)}</p>
            <p className="mt-3 text-[1.15rem]">{d.impact[`t${tier}`]}</p>
            {monthly && <p className="mt-2 text-muted">{d.monthlyNote}</p>}
          </>
        ) : (
          <p className="mt-4 text-muted">{d.impact.tsmall}</p>
        )}
        <p className="mt-6 border-t border-line pt-3 text-[0.88rem] text-muted">{d.illustrative}</p>
      </aside>
    </form>
  );
}
