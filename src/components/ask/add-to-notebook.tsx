"use client";

import Link from "next/link";
import { useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { addNote, browserStorage, MAX_NOTE_CHARS } from "@/lib/notebook-store";

/** "+ Add to my notebook" on the medical template: the parent's question becomes a note. */
export function AddToNotebook({
  text,
  locale,
  t,
}: {
  text: string;
  locale: Locale;
  t: Dictionary;
}) {
  const [state, setState] = useState<"idle" | "added" | "failed">("idle");
  const h = t.help;

  if (state === "added") {
    return (
      <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-sage">✓ {h.medicalAdded}</span>
        <Link href={`/${locale}/notebook`} className="link inline-flex min-h-11 items-center">
          {h.medicalOpenNotebook}
        </Link>
      </p>
    );
  }
  return (
    <div>
      <button
        type="button"
        className="btn-quiet border-glow/60"
        onClick={() =>
          setState(addNote(browserStorage(), text.slice(0, MAX_NOTE_CHARS)).ok ? "added" : "failed")
        }
      >
        {h.medicalAdd}
      </button>
      {state === "failed" && (
        <p role="status" className="mt-2 text-ember">
          {h.medicalAddFailed}
        </p>
      )}
    </div>
  );
}
