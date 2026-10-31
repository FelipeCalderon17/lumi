import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n";
import type { ChatOutcome } from "@/lib/chat-client";
import { Markdown } from "../markdown";
import { CallButtons, SafetyCard } from "../safety-card";
import { AddToNotebook } from "./add-to-notebook";
import { GapFlow } from "./gap-flow";

/**
 * One terminal outcome → what the parent sees. Every non-answer path is FIXED, reviewed copy
 * from the dictionaries (ADR 0003, 0010, 0011); only `answer` shows model text, and only after
 * the server validated it.
 */
export function ChatResponse({
  outcome,
  question,
  locale,
  t,
}: {
  outcome: Exclude<ChatOutcome, { kind: "aborted" } | { kind: "too_long" }>;
  question: string;
  locale: Locale;
  t: Dictionary;
}) {
  const s = t.safety;
  const h = t.help;
  const guide = (id: string) => `/${locale}/guides/${id}`;

  if (outcome.kind === "failed") return <Fallback t={t} rateLimited={false} />;
  const event = outcome.event;

  switch (event.type) {
    case "answer":
      return (
        <div>
          <Markdown source={event.text} headingOffset={1} hideCitations className="text-[1.1rem]" />
          <div className="mt-6 border-t border-line pt-4">
            <h3 className="eyebrow text-sage">{h.sourcesTitle}</h3>
            {/* The only place sources appear (answers show no inline markers). Plain titles in
                order; the dot is decorative. role="list" keeps list semantics in Safari, which
                drops them when list-style is none. */}
            {/* biome-ignore lint/a11y/noRedundantRoles: Safari/VoiceOver drops list semantics for unstyled lists. */}
            <ol role="list" className="mt-2 space-y-1">
              {event.citations.map((c) => (
                <li key={c.handle} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-[0.7em] size-1.5 shrink-0 rounded-pill bg-sage"
                  />
                  <Link href={guide(c.articleId)} className="link">
                    {c.title}
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[0.92rem] text-muted">{h.answerNote}</p>
          </div>
        </div>
      );

    case "emergency":
      return event.kind === "self_harm" ? (
        <SafetyCard
          tone="ember"
          title={s.selfHarm.title}
          steps={s.selfHarm.steps}
          actions={<CallButtons t={t} crisis />}
        />
      ) : (
        <SafetyCard
          tone="ember"
          title={s.emergency.title}
          steps={s.emergency.steps}
          actions={<CallButtons t={t} />}
        />
      );

    case "crisis":
      return (
        <SafetyCard
          tone="ember"
          title={s.crisis.title}
          body={s.crisis.body}
          steps={s.crisis.steps}
          actions={<CallButtons t={t} crisis />}
        >
          <p className="mt-6 border-t border-line pt-4 text-muted">
            {h.crisisCircles}{" "}
            <Link href={`/${locale}/community`} className="link">
              {h.crisisCirclesLink}
            </Link>
          </p>
        </SafetyCard>
      );

    case "medical":
      return (
        <SafetyCard title={s.medical.title} body={s.medical.body}>
          <p className="mt-4">
            {s.medical.articleLead}{" "}
            <Link href={guide(event.article.articleId)} className="link font-semibold">
              {event.article.title}
            </Link>
          </p>
          <div className="mt-5">
            <AddToNotebook text={question} locale={locale} t={t} />
          </div>
        </SafetyCard>
      );

    case "off_topic":
      return <SafetyCard title={s.offTopic.title} body={s.offTopic.body} />;

    case "abstained":
      return (
        <SafetyCard title={s.abstained.title} body={s.abstained.body}>
          <GapFlow question={question} language={event.language} topic={event.topic} t={t} />
        </SafetyCard>
      );

    case "fallback":
      return <Fallback t={t} rateLimited={event.reason === "rate_limited"} />;
  }
}

function Fallback({ t, rateLimited }: { t: Dictionary; rateLimited: boolean }) {
  const f = t.safety.fallback;
  return (
    <SafetyCard
      title={rateLimited ? f.rateLimited : f.title}
      body={f.body}
      actions={<CallButtons t={t} />}
    />
  );
}
