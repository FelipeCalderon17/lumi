"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { fill } from "@/i18n/format";
import { formatNoteDate } from "@/lib/dates";
import { localSafetyNotices, noticeCopy, noticeKinds } from "@/lib/notebook-safety";
import type { SheetData } from "@/lib/notebook-sheet";
import {
  addNote,
  browserStorage,
  clearNotes,
  deleteNote,
  loadNotes,
  MAX_NOTE_CHARS,
  restoreNote,
  type StoredNote,
  type WriteResult,
} from "@/lib/notebook-store";
import { config } from "@/server/config";
import type { NotebookResponse, NotebookSafetyNotice } from "@/server/notebook";
import type { EmergencyKind } from "@/server/safety";
import { VoiceInput } from "../voice-input";
import { NotebookSheet } from "./notebook-sheet";

const MAX_NOTES = config.limits.notebook.maxNotes;

type Prepare =
  | { kind: "idle" }
  | { kind: "preparing" }
  | {
      kind: "error";
      message: "prepareFailed" | "prepareInvalid";
      /** Notices the server returned with the error (a 400 still checks every note first). */
      serverNotices: NotebookSafetyNotice[];
    };

/**
 * My notebook: notes live ONLY in this browser (localStorage). "Prepare for my appointment"
 * sends them once to /api/notebook/prepare (processing notice shown first) and shows the page
 * the server builds from the notes themselves: safety notices first, then the parent's own
 * words under fixed topic headings (ADR 0015).
 */
export function Notebook({ locale, t }: { locale: Locale; t: Dictionary }) {
  const n = t.notebook;
  const [loaded, setLoaded] = useState(false);
  const [notes, setNotes] = useState<StoredNote[]>([]);
  const [recovered, setRecovered] = useState(false);
  const [draft, setDraft] = useState("");
  const [writeError, setWriteError] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<StoredNote | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [prepare, setPrepare] = useState<Prepare>({ kind: "idle" });
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null);
  const draftId = useId();

  useEffect(() => {
    const result = loadNotes(browserStorage());
    setNotes(result.notes);
    setRecovered(result.recovered);
    setLoaded(true);
  }, []);

  useEffect(() => () => request.current?.abort(), []);

  // The confirmation moves focus to the safe choice ("Keep my notes").
  useEffect(() => {
    if (confirmClear) keepRef.current?.focus();
  }, [confirmClear]);

  const apply = useCallback(
    (result: WriteResult) => {
      if (result.ok) {
        setNotes(result.notes);
        setWriteError(null);
        return true;
      }
      setWriteError(
        result.reason === "too_long" ? fill(n.tooLong, { max: MAX_NOTE_CHARS }) : n.storageError,
      );
      return false;
    },
    [n],
  );

  const save = () => {
    if (draft.trim() === "") return;
    if (apply(addNote(browserStorage(), draft))) {
      setDraft("");
      setLastDeleted(null);
    }
  };

  const remove = (note: StoredNote) => {
    if (apply(deleteNote(browserStorage(), note.id))) setLastDeleted(note);
  };

  const onVoiceText = useCallback((text: string) => {
    setDraft((prev) => (prev.trim() ? `${prev.trimEnd()}\n${text}` : text));
    draftRef.current?.focus();
  }, []);

  async function runPrepare() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPrepare({ kind: "preparing" });
    const sent = notes.slice(-MAX_NOTES).map(({ text, createdAt }) => ({ text, createdAt }));
    try {
      const response = await fetch("/api/notebook/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: sent, locale }),
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as
        | (NotebookResponse & { error?: undefined })
        | { error: string; safetyNotices?: NotebookSafetyNotice[] }
        | null;
      if (response.ok && body && "result" in body && body.result) {
        setSheet({ kind: "prepared", response: body, preparedAt: new Date() });
        setPrepare({ kind: "idle" });
        return;
      }
      const serverNotices = body && Array.isArray(body.safetyNotices) ? body.safetyNotices : [];
      setPrepare({
        kind: "error",
        message: body?.error === "invalid_notes" ? "prepareInvalid" : "prepareFailed",
        serverNotices,
      });
    } catch {
      if (!controller.signal.aborted)
        setPrepare({ kind: "error", message: "prepareFailed", serverNotices: [] });
    }
  }

  // The same deterministic check, on the device: offline or after an error, flagged notes still
  // get the fixed steps (B1, Phase 3 review).
  const localNotices = useMemo(() => localSafetyNotices(notes), [notes]);

  if (sheet) {
    return <NotebookSheet data={sheet} locale={locale} t={t} onBack={() => setSheet(null)} />;
  }

  const count = notes.length === 1 ? n.countOne : fill(n.count, { n: notes.length });

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="min-w-0 space-y-8">
        {/* New note */}
        <form
          className="rounded-soft border border-line bg-surface p-4 focus-within:border-glow/70 sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label htmlFor={draftId} className="eyebrow">
            {n.addLabel}
          </label>
          <textarea
            id={draftId}
            ref={draftRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setWriteError(null);
            }}
            rows={4}
            maxLength={MAX_NOTE_CHARS}
            placeholder={n.addPlaceholder}
            className="mt-2 block w-full resize-y bg-transparent px-1 text-[1.12rem] leading-relaxed outline-none focus-visible:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <VoiceInput locale={locale} t={t} onText={onVoiceText} />
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[0.85rem] text-muted tabular-nums" aria-live="off">
                {fill(n.charCount, { n: draft.length, max: MAX_NOTE_CHARS })}
              </span>
              <button type="submit" className="btn-lantern" disabled={draft.trim() === ""}>
                {n.add}
              </button>
            </div>
          </div>
          {writeError && (
            <p role="alert" className="mt-3 text-ember">
              {writeError}
            </p>
          )}
        </form>

        {/* The notes */}
        <section aria-labelledby="notes-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="notes-heading" className="text-3xl">
              {n.listTitle}
            </h2>
            {loaded && notes.length > 0 && <p className="text-muted">{count}</p>}
          </div>
          {recovered && (
            <p role="status" className="mt-3 rounded-soft bg-raised px-4 py-3">
              {n.recovered}
            </p>
          )}
          {lastDeleted && (
            <p
              role="status"
              className="mt-3 flex flex-wrap items-center gap-3 rounded-soft bg-raised px-4 py-2"
            >
              <span>✓ {n.deletedOne}</span>
              <button
                type="button"
                className="link min-h-11 font-semibold"
                onClick={() => {
                  if (apply(restoreNote(browserStorage(), lastDeleted))) setLastDeleted(null);
                }}
              >
                ↶ {n.undo}
              </button>
            </p>
          )}
          {loaded && notes.length === 0 && (
            <p className="mt-4 rounded-soft border border-dashed border-line p-6 text-muted">
              {n.empty}
            </p>
          )}
          <ol className="mt-4 space-y-3">
            {[...notes].reverse().map((note) => {
              const date = formatNoteDate(note.createdAt, locale);
              return (
                <li
                  key={note.id}
                  className="group rounded-soft border border-line bg-surface/70 p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <time
                      dateTime={note.createdAt}
                      className="text-[0.88rem] font-semibold text-glow"
                    >
                      {date}
                    </time>
                    <button
                      type="button"
                      onClick={() => remove(note)}
                      aria-label={fill(n.deleteLabel, { date })}
                      className="-mt-2 -mr-2 inline-flex min-h-11 items-center rounded-pill px-3 text-[0.92rem] text-muted hover:bg-raised hover:text-ember"
                    >
                      {n.delete}
                    </button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words">{note.text}</p>
                </li>
              );
            })}
          </ol>
          {notes.length > 0 && (
            <div className="mt-6">
              {confirmClear ? (
                <div
                  role="alertdialog"
                  aria-labelledby="clear-q"
                  className="rounded-soft border border-ember/50 p-4"
                >
                  <p id="clear-q" className="font-semibold">
                    {fill(n.clearConfirm, { n: notes.length })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-ember"
                      onClick={() => {
                        if (apply(clearNotes(browserStorage()))) {
                          setConfirmClear(false);
                          setLastDeleted(null);
                        }
                      }}
                    >
                      {n.clearYes}
                    </button>
                    <button
                      type="button"
                      className="btn-quiet"
                      ref={keepRef}
                      onClick={() => setConfirmClear(false)}
                    >
                      {n.clearNo}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn-ember" onClick={() => setConfirmClear(true)}>
                  {n.clearAll}
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Prepare for my appointment */}
      <aside className="rounded-soft border border-line bg-raised/50 p-5 lg:sticky lg:top-6">
        <h2 className="text-2xl">{n.prepareTitle}</h2>
        <p className="mt-2 text-muted">{n.prepareBody}</p>
        <p className="mt-4 flex gap-3 rounded-[0.6rem] bg-surface px-4 py-3 text-[0.92rem]">
          <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-pill bg-glow" />
          <span>{n.processingNotice}</span>
        </p>
        {notes.length > MAX_NOTES && (
          <p className="mt-3 text-[0.92rem] text-muted">{fill(n.tooMany, { max: MAX_NOTES })}</p>
        )}
        <button
          type="button"
          className="btn-lantern mt-5 w-full"
          disabled={notes.length === 0 || prepare.kind === "preparing"}
          onClick={() => void runPrepare()}
        >
          {prepare.kind === "preparing" ? (
            <>
              <span
                aria-hidden="true"
                className="size-2.5 animate-breathe rounded-pill bg-on-lantern"
              />
              {n.preparing}
            </>
          ) : (
            n.prepareButton
          )}
        </button>
        <div role="status" aria-live="polite">
          {prepare.kind === "error" && (
            <div className="mt-4 space-y-3">
              <SafetyNotices kinds={noticeKinds(prepare.serverNotices, localNotices)} t={t} />
              <p>{n[prepare.message]}</p>
              <button
                type="button"
                className="btn-quiet w-full"
                onClick={() =>
                  setSheet({
                    kind: "byDate",
                    notes,
                    preparedAt: new Date(),
                    serverNotices: prepare.serverNotices,
                  })
                }
              >
                {n.printByDate}
              </button>
            </div>
          )}
        </div>
        <p className="mt-5 text-[0.88rem] text-muted">{n.fromChat}</p>
      </aside>
    </div>
  );
}

/** Fixed emergency steps for flagged notes, ALWAYS shown before the notes (ADR 0003). */
export function SafetyNotices({ kinds, t }: { kinds: readonly EmergencyKind[]; t: Dictionary }) {
  if (kinds.length === 0) return null;
  return (
    <div className="space-y-3">
      {kinds.map((kind) => {
        const copy = noticeCopy(kind, t);
        return (
          <div
            key={kind}
            role="alert"
            className="rounded-soft border border-ember/60 bg-ember/8 p-4"
          >
            <p className="flex items-start gap-2 font-display text-xl leading-snug">
              <span
                aria-hidden="true"
                className="mt-[0.5em] size-2.5 shrink-0 rounded-pill bg-ember"
              />
              {copy.title}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 print:hidden">
              <a
                href="tel:911"
                className="inline-flex min-h-11 items-center rounded-pill bg-ember px-4 font-bold text-bg"
              >
                {t.safety.actions.call911}
              </a>
              {kind === "self_harm" && (
                <a href="tel:988" className="btn-quiet">
                  {t.safety.actions.call988}
                </a>
              )}
            </div>
            <p className="mt-3">{copy.body}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {copy.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
