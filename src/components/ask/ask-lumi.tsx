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
    <div className="mt-6 grid gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-x-12">
      {/* Mobile: above the card. Large screens: the side column. */}
      <p
        className={`self-start border-l-2 border-glow/60 pl-4 text-[0.98rem] text-muted lg:sticky lg:top-6 lg:col-start-2 ${started ? "lg:row-start-1" : "lg:row-start-2"}`}
      >
        {h.boundaries}
      </p>

      {/* One chat card: the conversation, then the composer. Answers never float outside it. */}
      <div className="min-w-0 rounded-soft border border-line bg-surface shadow-[0_30px_60px_-40px_rgb(0_0_0/0.55)] lg:col-start-1 lg:row-span-2 lg:row-start-1">
        {started && (
          <section
            aria-label={h.conversationLabel}
            className="relative border-b border-line px-4 pt-3 pb-8 sm:px-6 sm:pt-4"
          >
            <button
              type="button"
              onClick={startOver}
              className="absolute top-3 right-3 inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3 text-[0.92rem] text-muted transition-colors duration-200 hover:bg-raised hover:text-text sm:top-4 sm:right-4"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="M2.75 8a5.25 5.25 0 1 0 1.54-3.71" />
                <path d="M2.5 2.25v2.5H5" />
              </svg>
              {h.startOver}
            </button>
            <ol aria-live="polite" className="divide-y divide-line/60">
              {turns.map((turn, i) => (
                <li
                  key={turn.id}
                  ref={i === turns.length - 1 ? lastTurnRef : undefined}
                  className="scroll-mt-6 py-8 first:pt-0 last:pb-0"
                >
                  <p className="eyebrow flex min-h-11 items-center text-muted">{h.youAsked}</p>
                  <p className="font-display text-[1.45rem] leading-snug italic">
                    “{turn.question}”
                  </p>
                  <div className="mt-5 flex gap-3 sm:gap-4">
                    <LumiMark className="mt-1 hidden size-8 shrink-0 text-muted sm:block" />
                    <div className="min-w-0 max-w-[68ch] flex-1">
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
          </section>
        )}

        <form
          className="p-4 sm:p-5"
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
      </div>

      {!started && (
        <div className="lg:col-start-2 lg:row-start-1">
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
