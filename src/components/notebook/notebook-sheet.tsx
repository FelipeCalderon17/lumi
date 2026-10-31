"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { fill } from "@/i18n/format";
import { formatDay, formatNoteDate } from "@/lib/dates";
import type { StoredNote } from "@/lib/notebook-store";
import { notebookPlainText } from "@/lib/notebook-text";
import type { NotebookResponse, NotebookTopic } from "@/server/notebook";
import { LumiMark } from "../lumi-mark";
import { SafetyNotices } from "./notebook";

export type SheetData =
  | { kind: "prepared"; response: NotebookResponse; preparedAt: Date }
  /** No AI: the notes by date, when preparing failed. */
  | { kind: "byDate"; notes: StoredNote[]; preparedAt: Date };

type Group = {
  topic: NotebookTopic | null;
  notes: { key: string; text: string; createdAt: string; flagged: boolean }[];
};

/**
 * The doctor-ready page: safety notices first, then each note VERBATIM (whitespace and line
 * breaks kept) with its local date, under headings from the dictionaries. Print, Share (Web
 * Share API, else copy) and Copy.
 */
export function NotebookSheet({
  data,
  locale,
  t,
  onBack,
}: {
  data: SheetData;
  locale: Locale;
  t: Dictionary;
  onBack: () => void;
}) {
  const n = t.notebook;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [canShare, setCanShare] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    headingRef.current?.focus();
  }, []);

  const notices = data.kind === "prepared" ? data.response.safetyNotices : [];
  const flagged = new Set(notices.map((notice) => notice.noteIndex));
  const groups: Group[] =
    data.kind === "prepared"
      ? data.response.result.groups.map((group) => ({
          topic: group.topic,
          notes: group.notes.map((note) => ({
            key: String(note.index),
            text: note.text,
            createdAt: note.createdAt,
            flagged: flagged.has(note.index),
          })),
        }))
      : [
          {
            topic: null,
            notes: data.notes.map((note) => ({
              key: note.id,
              text: note.text,
              createdAt: note.createdAt,
              flagged: false,
            })),
          },
        ];
  const title = data.kind === "prepared" ? n.resultTitle : n.byDateTitle;
  const subtitle = fill(n.preparedOn, { date: formatDay(data.preparedAt, locale) });
  const intro =
    data.kind === "prepared"
      ? data.response.result.kind === "organized"
        ? n.organizedNote
        : n.fallbackNote
      : null;

  const plainText = () =>
    notebookPlainText({
      title,
      subtitle,
      safety: notices.length > 0 ? [n.safetyTitle, n.safetyBody] : [],
      groups: groups.map((group) => ({
        heading: group.topic ? n.topics[group.topic] : n.byDateTitle,
        notes: group.notes.map((note) => ({
          date: formatNoteDate(note.createdAt, locale),
          text: note.text,
        })),
      })),
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText());
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title, text: plainText() });
    } catch (error) {
      // The parent closing the share sheet isn't an error.
      if (!(error instanceof DOMException && error.name === "AbortError")) await copy();
    }
  };

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" onClick={onBack} className="btn-quiet mr-auto">
          <span aria-hidden="true">←</span> {n.backToNotes}
        </button>
        <button type="button" onClick={() => window.print()} className="btn-lantern">
          {n.print}
        </button>
        <button
          type="button"
          onClick={() => void (canShare ? share() : copy())}
          className="btn-quiet"
        >
          {n.share}
        </button>
        <button type="button" onClick={() => void copy()} className="btn-quiet">
          {n.copy}
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="mt-2 min-h-6 text-[0.95rem] text-muted print:hidden"
      >
        {copyState === "copied" ? `✓ ${n.copied}` : copyState === "failed" ? n.copyFailed : ""}
      </p>

      <article className="mt-4 rounded-soft border border-line bg-surface p-6 sm:p-10 print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-3xl leading-tight outline-none sm:text-4xl"
            >
              {title}
            </h2>
            <p className="mt-2 text-muted">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-muted">
            <LumiMark className="size-8" />
            <span className="font-display text-xl">Lumi</span>
          </div>
        </header>

        {notices.length > 0 && (
          <div className="mt-6">
            <SafetyNotices notices={notices} t={t} />
          </div>
        )}
        {intro && <p className="mt-6 text-muted">{intro}</p>}

        <div className="mt-6 space-y-8">
          {groups.map((group) => (
            <section key={group.topic ?? "by-date"} className="break-inside-avoid-page">
              {group.topic && (
                <h3 className="border-b border-line/70 pb-2 text-2xl">{n.topics[group.topic]}</h3>
              )}
              <ul className="mt-3 space-y-4">
                {group.notes.map((note) => (
                  <li
                    key={note.key}
                    className="break-inside-avoid grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4"
                  >
                    <time
                      dateTime={note.createdAt}
                      className="text-[0.9rem] font-semibold text-glow"
                    >
                      {note.flagged && (
                        <span
                          aria-hidden="true"
                          className="mr-1.5 inline-block size-2 rounded-pill bg-ember align-middle"
                        />
                      )}
                      {formatNoteDate(note.createdAt, locale)}
                    </time>
                    {/* The parent's words, exactly as written. */}
                    <p className="whitespace-pre-wrap break-words">{note.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-line pt-4 text-[0.85rem] text-muted">{n.printFooter}</p>
      </article>
    </div>
  );
}
