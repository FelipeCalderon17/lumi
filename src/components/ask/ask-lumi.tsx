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
 *
 * Layout: one full-width chat card. The turns scroll inside their own area (capped height,
 * keyboard-scrollable region), and the composer stays at the bottom of the card. The quick-start
 * chips and the boundaries note sit below the card.
 */
export function AskLumi({ locale, t }: { locale: Locale; t: Dictionary }) {
  const h = t.help;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [tooLong, setTooLong] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const lastTurnRef = useRef<HTMLLIElement>(null);
  const lastResponseRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
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
    setScrolled(false);
    setInput("");
    setTooLong(false);
    inputRef.current?.focus();
  };

  // Keep the newest turn in view, scrolling the conversation AREA (not the page): its question
  // goes to the top of the area when it's added and again when the response arrives. If that
  // would leave the response below the area's fold, the response start goes to the top instead.
  // Emergency and crisis cards go to the top whenever they don't fit whole under the question,
  // so the call buttons are on screen without scrolling. Instant under reduced motion.
  const last = turns.at(-1);
  const lastKey = last ? `${last.id}:${last.outcome === null ? "waiting" : "shown"}` : "";
  const lastUrgent =
    last?.outcome?.kind === "event" &&
    (last.outcome.event.type === "emergency" || last.outcome.event.type === "crisis");
  useEffect(() => {
    const area = scrollRef.current;
    const turn = lastTurnRef.current;
    if (!lastKey || !area || !turn) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    const offsetIn = (el: Element) =>
      el.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop;
    let top = offsetIn(turn) - 16;
    const response = lastResponseRef.current;
    if (response) {
      const responseTop = offsetIn(response);
      const fold = top + area.clientHeight;
      const hidden = lastUrgent
        ? responseTop + response.offsetHeight > fold
        : responseTop + 96 > fold;
      if (hidden) top = responseTop - 16;
    }
    area.scrollTo({ top: Math.max(0, top), behavior });
    // The card is sized to fit the viewport (capped area + composer). If it isn't fully on screen
    // (a chip below it was tapped, or the response grew the area), bring it on screen so the
    // composer stays visible. A no-op when it already is.
    cardRef.current?.scrollIntoView({ block: "nearest", behavior });
  }, [lastKey, lastUrgent]);

  const onVoiceText = useCallback((text: string) => {
    setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    inputRef.current?.focus();
  }, []);

  const started = turns.length > 0;

  return (
    <div className="mt-6 space-y-8 lg:mt-10">
      {/* One full-width chat card: the conversation (its own scroll area), then the composer.
          The card glows while the composer has focus (the textarea draws no outline itself);
          the gap flow's textarea, deeper inside, doesn't trigger it. */}
      <div
        ref={cardRef}
        className="flex flex-col rounded-soft border border-line bg-surface shadow-[0_30px_60px_-40px_rgb(0_0_0/0.55)] transition-[border-color,box-shadow] duration-200 has-[>form_textarea:focus]:border-glow has-[>form_textarea:focus]:ring-3 has-[>form_textarea:focus]:ring-glow/45"
      >
        {started && (
          <>
            {/* Outside the scroll area, so "Start over" is always reachable. */}
            <div className="flex items-center justify-between gap-3 border-b border-line/60 py-1 pr-2 pl-4 sm:pr-3 sm:pl-6">
              <p className="flex items-center gap-2 font-display text-[1.05rem] text-muted">
                <LumiMark className="size-6" />
                {h.lumiSays}
              </p>
              <button
                type="button"
                onClick={startOver}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3 text-[0.92rem] text-muted transition-colors duration-200 hover:bg-raised hover:text-text"
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
            </div>
            {/* A labelled <section> is a "region" landmark. Phones: the height left once the card
                header, the composer and the page scroll padding (~24rem) are on screen, so the whole card fits the viewport. */}
            <section
              ref={scrollRef}
              aria-label={h.conversationLabel}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1).
              tabIndex={0}
              onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 4)}
              className={`max-h-[max(16rem,calc(100dvh_-_24rem))] scrollbar-lumi overflow-y-auto px-4 py-6 focus-visible:outline-offset-[-3px] sm:max-h-[min(60vh,40rem)] sm:px-6 ${
                scrolled ? "shadow-[inset_0_12px_12px_-12px_rgb(0_0_0/0.4)]" : ""
              }`}
            >
              <ol aria-live="polite" className="divide-y divide-line/60">
                {turns.map((turn, i) => {
                  const newest = i === turns.length - 1;
                  return (
                    <li
                      key={turn.id}
                      ref={newest ? lastTurnRef : undefined}
                      className="py-8 first:pt-0 last:pb-0"
                    >
                      <p className="eyebrow text-muted">{h.youAsked}</p>
                      <p className="mt-2 font-display text-[1.45rem] leading-snug italic">
                        “{turn.question}”
                      </p>
                      <div className="mt-5 flex gap-3 sm:gap-4">
                        <LumiMark className="mt-1 hidden size-8 shrink-0 text-muted sm:block" />
                        <div className="min-w-0 max-w-[76ch] flex-1">
                          {turn.outcome === null ? (
                            <p className="flex items-center gap-3 py-2 text-muted">
                              <span
                                aria-hidden="true"
                                className="size-3 animate-breathe rounded-pill bg-lantern shadow-[0_0_18px_4px_rgb(246_190_79/0.45)]"
                              />
                              {h.progress}
                            </p>
                          ) : (
                            <div
                              ref={newest ? lastResponseRef : undefined}
                              className="animate-reveal"
                            >
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
                  );
                })}
              </ol>
            </section>
          </>
        )}

        <form
          className={`p-4 sm:p-5 ${started ? "border-t border-line" : ""}`}
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
            rows={started ? 2 : 3}
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
        <div>
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

      <p className="max-w-3xl border-l-2 border-glow/60 pl-4 text-[0.98rem] text-muted">
        {h.boundaries}
      </p>
    </div>
  );
}
