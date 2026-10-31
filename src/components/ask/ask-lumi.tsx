"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { askLumi, type ChatOutcome } from "@/lib/chat-client";
import { LumiMark } from "../lumi-mark";
import { VoiceInput } from "../voice-input";
import { ChatResponse } from "./chat-response";

type Shown = Exclude<ChatOutcome, { kind: "aborted" } | { kind: "too_long" }>;
type Turn = { id: number; question: string; outcome: Shown | null };

/**
 * Ask Lumi: a session-only conversation in this tab (never persisted, ADR 0005). One request
 * at a time: a new question, "Start over" or leaving the page aborts the one in flight.
 */
export function AskLumi({ locale, t }: { locale: Locale; t: Dictionary }) {
  const h = t.help;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [tooLong, setTooLong] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastTurnRef = useRef<HTMLLIElement>(null);
  const inputId = useId();

  useEffect(() => () => controller.current?.abort(), []);

  const waiting = turns.at(-1)?.outcome === null;

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (question === "") return;
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      const id = nextId.current++;
      setTooLong(false);
      setInput("");
      // A question still waiting is dropped: its request was just aborted.
      setTurns((prev) => [
        ...prev.filter((turn) => turn.outcome !== null),
        { id, question, outcome: null },
      ]);

      const outcome = await askLumi(question, locale, { signal: current.signal });
      if (outcome.kind === "aborted" || current.signal.aborted) return;
      if (outcome.kind === "too_long") {
        setTurns((prev) => prev.filter((turn) => turn.id !== id));
        setInput(question);
        setTooLong(true);
        inputRef.current?.focus();
        return;
      }
      setTurns((prev) => prev.map((turn) => (turn.id === id ? { ...turn, outcome } : turn)));
    },
    [locale],
  );

  const startOver = () => {
    controller.current?.abort();
    controller.current = null;
    setTurns([]);
    setInput("");
    setTooLong(false);
    inputRef.current?.focus();
  };

  // Bring the newest turn into view (no smooth scroll for reduced motion).
  const turnCount = turns.length;
  useEffect(() => {
    if (turnCount === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastTurnRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [turnCount]);

  const onVoiceText = useCallback((text: string) => {
    setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    inputRef.current?.focus();
  }, []);

  const started = turns.length > 0;

  return (
    <div className="mt-8">
      {started && (
        <section aria-label={h.conversationLabel}>
          <ol aria-live="polite" className="space-y-10">
            {turns.map((turn, i) => (
              <li
                key={turn.id}
                ref={i === turns.length - 1 ? lastTurnRef : undefined}
                className="scroll-mt-6"
              >
                <p className="eyebrow text-muted">{h.youAsked}</p>
                <p className="mt-1 font-display text-[1.45rem] leading-snug italic">
                  “{turn.question}”
                </p>
                <div className="mt-4 flex gap-3 sm:gap-4">
                  <LumiMark className="mt-1 hidden size-8 shrink-0 text-muted sm:block" />
                  <div className="min-w-0 flex-1">
                    {turn.outcome === null ? (
                      <p className="flex items-center gap-3 py-2 text-muted">
                        <span
                          aria-hidden="true"
                          className="size-3 animate-breathe rounded-pill bg-lantern shadow-[0_0_18px_4px_rgb(246_190_79/0.45)]"
                        />
                        {h.progress}
                      </p>
                    ) : (
                      <div className="animate-reveal">
                        <ChatResponse
                          outcome={turn.outcome}
                          question={turn.question}
                          locale={locale}
                          t={t}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-[0.92rem] text-muted">{h.sessionNote}</p>
            <button type="button" onClick={startOver} className="btn-quiet">
              <span aria-hidden="true">↺</span> {h.startOver}
            </button>
          </div>
        </section>
      )}

      <form
        className={`rounded-soft border border-line bg-surface p-4 shadow-[0_30px_60px_-40px_rgb(0_0_0/0.55)] sm:p-5 ${started ? "mt-8" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          void ask(input);
        }}
      >
        {!started && (
          <p className="mb-4 flex gap-3 rounded-[0.6rem] bg-raised px-4 py-3 text-[0.95rem]">
            <span
              aria-hidden="true"
              className="mt-[0.55em] size-1.5 shrink-0 rounded-pill bg-glow"
            />
            <span>{h.processingNotice}</span>
          </p>
        )}
        <label htmlFor={inputId} className="sr-only">
          {h.inputLabel}
        </label>
        <textarea
          id={inputId}
          ref={inputRef}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setTooLong(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void ask(input);
            }
          }}
          rows={3}
          enterKeyHint="send"
          placeholder={h.placeholder}
          aria-invalid={tooLong || undefined}
          aria-describedby={tooLong ? `${inputId}-long` : undefined}
          className="block w-full resize-none bg-transparent px-1 text-[1.15rem] leading-relaxed outline-none placeholder:text-muted focus-visible:outline-none"
        />
        {tooLong && (
          <p id={`${inputId}-long`} role="alert" className="mt-2 px-1 text-ember">
            {h.tooLong}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <VoiceInput locale={locale} t={t} onText={onVoiceText} disabled={waiting} />
          <button type="submit" className="btn-lantern ml-auto" disabled={input.trim() === ""}>
            {h.send}
            <span aria-hidden="true">→</span>
          </button>
        </div>
        {started && <p className="mt-3 px-1 text-[0.85rem] text-muted">{h.processingNotice}</p>}
      </form>

      {!started && (
        <div className="mt-8">
          <p className="text-[0.95rem] text-muted">{h.chipsLabel}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {h.chips.map((chip) => (
              <li key={chip.label}>
                <button
                  type="button"
                  onClick={() => void ask(chip.question)}
                  className="min-h-11 rounded-pill border border-line bg-surface/60 px-4 text-[0.98rem] transition-colors duration-200 hover:border-glow hover:bg-raised"
                >
                  {chip.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
