# Process log: building Lumi with AI agents

An honest record of what the agents did and what the human (Felipe) decided. Newest entries at the bottom.

## Roles

| Role | Who | Responsibility |
|---|---|---|
| Product owner / engineer | **Felipe Calderón** (human) | Picks the slice, approves architecture, owns tone and safety decisions, reviews and merges. |
| Orchestrator | Claude Opus 5.5 | Turns Felipe's decisions into phased briefs for the builder; coordinates review rounds. |
| Builder | Claude Opus 5.5 (Claude Code) | Implements each phase in this repo, runs checks, reports back. |
| Reviewer | GPT-6.1 Sol (Codex) | Independent review of each phase from a different model family. |

Using a different model family for review is deliberate: two models from the same family tend to share blind spots.

---

## Entry 1 — Phase 0: foundations (2026-10-30)

**Human decisions (before any code).** Working with the orchestrator, Felipe chose:

- The name **Lumi** and its bilingual identity ("A little light for the long nights" / "Una lucecita para las noches largas").
- The deep slice: a **bilingual Family Support Assistant** grounded only in a curated KB, plus a staff **gaps** view fed by consented unanswered questions. Donate, volunteer and about stay as placeholders.
- The pipeline shape (deterministic safety → cheap router → whole-KB answer with citations → validation → ledger) and the eight ADRs in `docs/decisions/`.
- Constraints: no accounts, no conversation storage, no paid API calls in Phase 0, no remote/push/deploy yet.

**What the builder agent did.**

- Checked current library APIs before writing any AI code: used the Context7 docs tool for the AI SDK (`generateText` + `Output.object`, `streamText`, `usage.inputTokenDetails.cacheReadTokens`) and Next.js 16 (`proxy.ts`, `PageProps`/`LayoutProps`, `next typegen`), and confirmed `gpt-6-luna` is a known model id in the installed `@ai-sdk/openai` types.
- Scaffolded the app by hand rather than with `create-next-app`, to avoid ESLint/template files we'd delete: Next.js 16.4, React 19.3, TypeScript 7 strict (+ `noUncheckedIndexedAccess`), Tailwind 4, Biome 2.6, Vitest 5, Zod 4, AI SDK 7, Drizzle.
- Wrote typed contracts and `NotImplementedError` stubs for every server module, with Zod schemas where they define a boundary (router output, KB frontmatter, gap submission, chat request, golden case). Planned behaviour is recorded as `it.todo` so the next phase starts from a test list.
- Built bilingual route shells, the design token theme and the Lumi mark. Computed WCAG contrast for every token pair with a script before committing to the palette.
- Wrote the docs: architecture, ADRs, content guidelines, evals plan, design, this log.

**Notable calls the builder made (flagged for Felipe).**

- Added a `rate-limit/` module and a `pipeline.ts` contract (not in the original module list) because config and ADR 0006 needed a home for them.
- Kept the abstain signal as an explicit marker (`[[NO_ANSWER]]`) as the first token, so abstention is detectable before the stream ends.
- Excluded Markdown from Biome: its Markdown formatter rewrote YAML examples inside code fences.
- Open questions are listed in `docs/ARCHITECTURE.md#open-questions` rather than decided silently.

**Checks.** `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (18 passing, 19 todo), `pnpm build` all pass. Smoke test with `next start`: `/` redirects by `Accept-Language`, `/es` renders with `lang="es"`, `/api/chat` returns 400 on bad input and 501 otherwise.
