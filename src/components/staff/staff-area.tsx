"use client";

import { useCallback, useEffect, useId, useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { fill } from "@/i18n/format";
import type { CostEstimate } from "@/server/ledger";
import type { StaffOverview } from "@/server/staff";

/** The staff overview as it arrives over JSON (dates are strings). */
type Overview = Omit<StaffOverview, "gaps"> & {
  gaps:
    | {
        status: "ok";
        items: (Omit<
          Extract<StaffOverview["gaps"], { status: "ok" }>["items"][number],
          "createdAt"
        > & { createdAt: string })[];
      }
    | { status: "unavailable" | "failed" };
};

type View =
  | { kind: "loading" }
  | { kind: "login"; note: "wrong" | "rateLimited" | "expired" | null }
  | { kind: "disabled" }
  | { kind: "error" }
  | { kind: "ready"; overview: Overview };

/**
 * Staff area (ADR 0008): passcode → HMAC session cookie (httpOnly, set by the server), then the
 * saved questions and the usage summary with DERIVED cost. Every response is private/no-store
 * on the server; we fetch with `cache: "no-store"` too. Fails closed: 503 = not configured.
 */
export function StaffArea({ locale, t }: { locale: Locale; t: Dictionary }) {
  const s = t.staff;
  const [view, setView] = useState<View>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/gaps", { cache: "no-store" });
      if (response.status === 401) return setView({ kind: "login", note: null });
      if (response.status === 503) return setView({ kind: "disabled" });
      if (!response.ok) return setView({ kind: "error" });
      setView({ kind: "ready", overview: (await response.json()) as Overview });
    } catch {
      setView({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const logout = async () => {
    await fetch("/api/staff/logout", { method: "POST" }).catch(() => {});
    setView({ kind: "login", note: null });
  };

  if (view.kind === "loading") return <p className="mt-10 text-muted">…</p>;
  if (view.kind === "disabled") return <Notice text={s.disabled} />;
  if (view.kind === "error")
    return (
      <Notice text={s.loadFailed}>
        <button type="button" className="btn-quiet mt-4" onClick={() => void load()}>
          {t.gaps.retry}
        </button>
      </Notice>
    );
  if (view.kind === "login")
    return (
      <Login
        t={t}
        note={view.note}
        onDone={load}
        onDisabled={() => setView({ kind: "disabled" })}
      />
    );

  return (
    <Dashboard
      locale={locale}
      t={t}
      overview={view.overview}
      onExpired={() => setView({ kind: "login", note: "expired" })}
      onLogout={logout}
    />
  );
}

function Notice({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div role="status" className="mt-10 max-w-xl rounded-soft border border-dashed border-line p-6">
      <p>{text}</p>
      {children}
    </div>
  );
}

function Login({
  t,
  note,
  onDone,
  onDisabled,
}: {
  t: Dictionary;
  note: "wrong" | "rateLimited" | "expired" | null;
  onDone: () => Promise<void>;
  onDisabled: () => void;
}) {
  const s = t.staff;
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(note);
  const id = useId();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passcode === "") return;
    setBusy(true);
    try {
      const response = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
        cache: "no-store",
      });
      if (response.ok) {
        setPasscode("");
        await onDone();
        return;
      }
      if (response.status === 503) return onDisabled();
      setError(response.status === 429 ? "rateLimited" : "wrong");
    } catch {
      setError("wrong");
    } finally {
      setBusy(false);
    }
  };

  const message = error === "expired" ? s.expired : error ? s[error] : null;
  return (
    <form
      onSubmit={submit}
      className="mt-10 max-w-md rounded-soft border border-line bg-surface p-6 sm:p-8"
    >
      <h2 className="text-3xl">{s.loginTitle}</h2>
      <p className="mt-2 text-muted">{s.loginLede}</p>
      <label htmlFor={id} className="mt-6 mb-1.5 block font-semibold">
        {s.passcode}
      </label>
      <input
        id={id}
        type="password"
        autoComplete="current-password"
        className="field"
        value={passcode}
        onChange={(e) => {
          setPasscode(e.target.value);
          setError(null);
        }}
        aria-invalid={error === "wrong" || undefined}
        aria-describedby={message ? `${id}-msg` : undefined}
      />
      {message && (
        <p id={`${id}-msg`} role="alert" className="mt-2 text-ember">
          {message}
        </p>
      )}
      <button type="submit" className="btn-lantern mt-6 w-full" disabled={busy || passcode === ""}>
        {busy ? s.signingIn : s.signIn}
      </button>
    </form>
  );
}

function usd(value: CostEstimate, unknown: string): string {
  if (value === "unknown") return unknown;
  if (value === 0) return "$0.00";
  return value >= 1
    ? `$${value.toFixed(2)}`
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumSignificantDigits: 3,
      }).format(value);
}

function Dashboard({
  locale,
  t,
  overview,
  onExpired,
  onLogout,
}: {
  locale: Locale;
  t: Dictionary;
  overview: Overview;
  onExpired: () => void;
  onLogout: () => void;
}) {
  const s = t.staff;
  const [items, setItems] = useState(overview.gaps.status === "ok" ? overview.gaps.items : []);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rowNote, setRowNote] = useState<{ id: string; text: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const when = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const number = new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US");
  const topicLabel = (topic: string) =>
    topic in t.guides.categories
      ? t.guides.categories[topic as keyof Dictionary["guides"]["categories"]]
      : s.otherTopic;

  const remove = async (id: string) => {
    setConfirming(null);
    try {
      const response = await fetch(`/api/staff/gaps/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 503) return onExpired();
      const body = (await response.json().catch(() => null)) as { status?: string } | null;
      if (body?.status === "deleted" || body?.status === "not_found") {
        setItems((prev) => prev.filter((item) => item.id !== id));
        setStatus(body.status === "deleted" ? s.deleted : s.deleteNotFound);
        return;
      }
      setRowNote({ id, text: body?.status === "unavailable" ? s.gapsUnavailable : s.deleteFailed });
    } catch {
      setRowNote({ id, text: s.deleteFailed });
    }
  };

  const usage = overview.usage;

  return (
    <div className="mt-8 space-y-14">
      <section aria-labelledby="gaps-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="gaps-title" className="text-4xl">
            {s.gapsTitle}
          </h2>
          <button type="button" className="btn-quiet" onClick={onLogout}>
            {s.signOut}
          </button>
        </div>
        <p className="mt-3 max-w-3xl text-muted">{s.gapsLede}</p>
        <p role="status" aria-live="polite" className="mt-3 min-h-6 text-sage">
          {status}
        </p>
        {overview.gaps.status !== "ok" ? (
          <Notice
            text={overview.gaps.status === "unavailable" ? s.gapsUnavailable : s.gapsFailed}
          />
        ) : items.length === 0 ? (
          <p className="mt-4 rounded-soft border border-dashed border-line p-6 text-muted">
            {s.noGaps}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-soft border border-line bg-surface">
            {items.map((item) => (
              <li key={item.id} className="p-5">
                <p className="whitespace-pre-wrap break-words text-[1.08rem]">{item.question}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.92rem] text-muted">
                  <span>
                    {s.language}: <span className="text-text">{s.languages[item.language]}</span>
                  </span>
                  <span>
                    {s.topic}: <span className="text-text">{topicLabel(item.topic)}</span>
                  </span>
                  <span>
                    {s.saved}:{" "}
                    <time dateTime={item.createdAt} className="text-text">
                      {when.format(new Date(item.createdAt))}
                    </time>
                  </span>
                  <span className="ml-auto flex gap-2">
                    {confirming === item.id ? (
                      <>
                        <button
                          type="button"
                          className="btn-ember"
                          onClick={() => void remove(item.id)}
                        >
                          {s.deleteConfirm}
                        </button>
                        <button
                          type="button"
                          className="btn-quiet"
                          onClick={() => setConfirming(null)}
                        >
                          {s.deleteCancel}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-quiet"
                        onClick={() => {
                          setConfirming(item.id);
                          setRowNote(null);
                        }}
                      >
                        {s.delete}
                      </button>
                    )}
                  </span>
                </div>
                {rowNote?.id === item.id && <p className="mt-2 text-ember">{rowNote.text}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="usage-title">
        {usage.status !== "ok" ? (
          <>
            <h2 id="usage-title" className="text-4xl">
              {fill(s.usageTitle, { days: 30 })}
            </h2>
            <Notice text={usage.status === "unavailable" ? s.usageUnavailable : s.usageFailed} />
          </>
        ) : (
          <>
            <h2 id="usage-title" className="text-4xl">
              {fill(s.usageTitle, { days: usage.windowDays })}
            </h2>
            <p
              className={`mt-4 flex gap-3 rounded-soft px-4 py-3 ${
                usage.complete ? "bg-sage/10" : "border border-ember/60 bg-ember/8 font-semibold"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-[0.55em] size-2 shrink-0 rounded-pill ${usage.complete ? "bg-sage" : "bg-ember"}`}
              />
              {usage.complete ? s.complete : s.incomplete}
            </p>
            <dl className="mt-6 grid gap-px overflow-hidden rounded-soft border border-line bg-line sm:grid-cols-4">
              {[
                [s.requests, number.format(usage.summary.requests)],
                [s.estimatedCost, usd(usage.summary.estimatedUsd, s.unknown)],
                [s.per1000, usd(usage.summary.estimatedUsdPer1000Requests, s.unknown)],
                [
                  s.cachedShare,
                  usage.summary.cachedInputRatio === null
                    ? s.unknown
                    : `${Math.round(usage.summary.cachedInputRatio * 100)}%`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="bg-surface p-5">
                  <dt className="text-[0.9rem] text-muted">{label}</dt>
                  <dd className="mt-1 font-display text-3xl">{value}</dd>
                </div>
              ))}
            </dl>
            {usage.summary.groups.length === 0 ? (
              <p className="mt-4 text-muted">{s.noUsage}</p>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-soft border border-line">
                <table className="w-full min-w-[36rem] text-left text-[0.95rem]">
                  <thead className="bg-raised/60 text-muted">
                    <tr>
                      {[
                        s.step,
                        s.model,
                        s.calls,
                        s.inputTokens,
                        s.outputTokens,
                        s.audioSeconds,
                        s.cost,
                      ].map((h) => (
                        <th key={h} scope="col" className="px-4 py-3 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {usage.summary.groups.map((g) => (
                      <tr key={`${g.step}-${g.model}`}>
                        <td className="px-4 py-3">{g.step}</td>
                        <td className="px-4 py-3 font-mono text-[0.88rem]">{g.model}</td>
                        <td className="px-4 py-3 tabular-nums">{number.format(g.calls)}</td>
                        <td className="px-4 py-3 tabular-nums">{number.format(g.inputTokens)}</td>
                        <td className="px-4 py-3 tabular-nums">{number.format(g.outputTokens)}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {number.format(Math.round(g.audioSeconds))}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{usd(g.estimatedUsd, s.unknown)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-4 text-[0.92rem] text-muted">{s.derivedNote}</p>
          </>
        )}
      </section>
    </div>
  );
}
