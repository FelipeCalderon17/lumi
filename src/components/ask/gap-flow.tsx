"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Dictionary } from "@/i18n";
import { redactContactDetails } from "@/server/gaps/redact";
import type { Language } from "@/server/types";
import type { GapTopicFromEvent } from "./types";

type Credentials = { id: string; deleteToken: string };

type Phase =
  | "offer"
  | "edit"
  | "saving"
  | "saved"
  | "uncertain"
  | "failed"
  | "unavailable"
  | "rate_limited"
  | "declined"
  | "deleting"
  | "deleted";

type DeleteNote = "deleteFailed" | "deleteNotFound" | "unavailable" | null;

/**
 * The opt-in gap flow after an `abstained` answer (ADR 0005): offer → editable, redacted
 * preview + disclosure + consent → save. Handles every save status. The delete token lives
 * ONLY in this component's state (tab memory), so "Delete my question" works while the tab is
 * open, and is gone when it closes.
 */
export function GapFlow({
  question,
  language,
  topic,
  t,
}: {
  question: string;
  language: Language;
  topic: GapTopicFromEvent;
  t: Dictionary;
}) {
  const g = t.gaps;
  const [phase, setPhase] = useState<Phase>("offer");
  const [text, setText] = useState(() => redactContactDetails(question, language));
  const [consent, setConsent] = useState(false);
  const [emptyError, setEmptyError] = useState(false);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [deleteNote, setDeleteNote] = useState<DeleteNote>(null);
  const fieldId = useId();
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (phase === "edit") editRef.current?.focus();
  }, [phase]);

  async function save(retry: Credentials | null) {
    const clean = text.trim();
    if (clean === "") {
      setEmptyError(true);
      return;
    }
    setPhase("saving");
    try {
      const response = await fetch("/api/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: clean,
          language,
          topic,
          consent: true,
          ...(retry ? { retry } : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        status?: string;
        id?: string;
        deleteToken?: string;
      } | null;
      const status = response.ok ? body?.status : undefined;
      if ((status === "saved" || status === "uncertain") && body?.id && body.deleteToken) {
        setCreds({ id: body.id, deleteToken: body.deleteToken });
        setPhase(status);
      } else if (status === "unavailable" || status === "rate_limited") {
        setPhase(status);
      } else {
        // `failed`, a 4xx/5xx or anything unexpected. A retry keeps its credentials.
        setPhase(retry ? "uncertain" : "failed");
      }
    } catch {
      setPhase(retry ? "uncertain" : "failed");
    }
  }

  async function remove() {
    if (!creds) return;
    const previous = phase;
    setPhase("deleting");
    setDeleteNote(null);
    try {
      const response = await fetch(`/api/gaps/${encodeURIComponent(creds.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteToken: creds.deleteToken }),
      });
      const body = (await response.json().catch(() => null)) as { status?: string } | null;
      const status = response.ok ? body?.status : undefined;
      if (status === "deleted") {
        setCreds(null);
        setPhase("deleted");
        return;
      }
      setDeleteNote(
        status === "not_found"
          ? "deleteNotFound"
          : status === "unavailable"
            ? "unavailable"
            : "deleteFailed",
      );
    } catch {
      setDeleteNote("deleteFailed");
    }
    setPhase(previous === "uncertain" ? "uncertain" : "saved");
  }

  // Dashed: visibly a separate, opt-in step. Muted (not `line`) so it reads on the raised panel.
  const box = "mt-5 rounded-soft border border-dashed border-muted/45 p-4 sm:p-5";

  if (phase === "declined") return null;

  if (phase === "offer") {
    return (
      <div className={box}>
        <p className="font-semibold">{g.offer}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-quiet border-glow/60"
            onClick={() => setPhase("edit")}
          >
            {g.yes}
          </button>
          <button type="button" className="btn-quiet" onClick={() => setPhase("declined")}>
            {g.cancel}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "edit" || phase === "saving") {
    return (
      <form
        className={box}
        onSubmit={(event) => {
          event.preventDefault();
          void save(null);
        }}
      >
        <label htmlFor={fieldId} className="block font-semibold">
          {g.previewLabel}
        </label>
        <textarea
          id={fieldId}
          ref={editRef}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setEmptyError(false);
          }}
          rows={3}
          className="field mt-3 resize-y"
          aria-describedby={`${fieldId}-disclosure${emptyError ? ` ${fieldId}-error` : ""}`}
          aria-invalid={emptyError || undefined}
        />
        {emptyError && (
          <p id={`${fieldId}-error`} className="mt-2 text-ember">
            {g.empty}
          </p>
        )}
        <p id={`${fieldId}-disclosure`} className="mt-3 text-[0.95rem] text-muted">
          {g.disclosure}
        </p>
        <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-1 size-5 shrink-0 accent-[#f6be4f]"
          />
          <span>{g.consent}</span>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="btn-lantern" disabled={!consent || phase === "saving"}>
            {phase === "saving" ? g.saving : g.save}
          </button>
          <button type="button" className="btn-quiet" onClick={() => setPhase("declined")}>
            {g.cancel}
          </button>
        </div>
      </form>
    );
  }

  const message: Partial<Record<Phase, string>> = {
    saved: g.saved,
    uncertain: g.uncertain,
    failed: g.failed,
    unavailable: g.unavailable,
    rate_limited: g.rateLimited,
    deleted: g.deleted,
  };
  const deleteNoteText =
    deleteNote === "unavailable" ? g.unavailable : deleteNote ? g[deleteNote] : null;
  const canDelete =
    creds !== null && (phase === "saved" || phase === "uncertain" || phase === "deleting");

  return (
    <div className={box} role="status" aria-live="polite">
      <p className={phase === "failed" || phase === "uncertain" ? "font-semibold" : undefined}>
        {phase === "deleting" ? g.deleting : message[phase]}
      </p>
      {phase === "saved" && <p className="mt-1 text-[0.95rem] text-muted">{g.tabNote}</p>}
      {deleteNoteText && <p className="mt-2 text-ember">{deleteNoteText}</p>}
      <div className="mt-4 flex flex-wrap gap-2 empty:hidden">
        {phase === "uncertain" && creds && (
          <button
            type="button"
            className="btn-quiet border-glow/60"
            onClick={() => void save(creds)}
          >
            {g.retry}
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className="btn-ember"
            onClick={() => void remove()}
            disabled={phase === "deleting"}
          >
            {phase === "deleting" ? g.deleting : g.delete}
          </button>
        )}
      </div>
    </div>
  );
}
