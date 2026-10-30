# AGENTS.md: rules for AI agents working in this repo

Lumi is a prototype assistant for families of children with cancer. Mistakes here aren't just bugs: they can mislead a frightened parent. Read `docs/ARCHITECTURE.md` and `docs/CONTENT-GUIDELINES.md` before changing behaviour.

## Hard safety rules

- **Never open, print, `cat`, `grep`, copy or commit `.env` / `.env.local` or any secret.** Only `.env.example` (empty values) is tracked. `.gitignore` ignores `.env*` except `.env.example`; don't change that.
- **Don't call paid APIs** (OpenAI etc.) unless the task explicitly asks for it (e.g. `pnpm eval` run by the human). Tests must never hit the network.
- **Don't create remotes, push or deploy** unless explicitly asked.
- **Don't use or imitate real organisations, hospitals, people or phone numbers.** The only number allowed in content is the generic 911.
- **Never weaken a guardrail without an ADR.** That includes the safety pre-check, the medical boundary, citation validation, input/output limits, rate limits, timeouts, the single retry layer and the no-conversation-storage rule. Write a new ADR in `docs/decisions/` that supersedes the old one, and get the human to approve it.

## Architecture conventions

- `src/server/` is **framework-free TypeScript**: no imports from `next`, `react`, or `src/app`. Route handlers in `src/app/api/` stay thin (parse → call server → serialise).
- **All tunables live in `src/server/config.ts`** (models, timeouts, limits, rate limit, retries, pricing). No magic numbers elsewhere.
- **One retry layer only**: `maxRetries` on the AI SDK call. Don't add retry loops.
- Every failure path ends in a calm, typed `ChatEvent` (`fallback`, `abstained`…). Never a blank screen or raw error.
- Never log or store message content. Ledger rows hold numbers and enums only.
- Validate at boundaries with Zod; use the inferred types.
- UI copy goes in `src/i18n/dictionaries/` (EN is the reference type; ES must match). KB content goes in `content/kb/{en,es}/` with the same `id` in both.
- Components use semantic design tokens (`bg-surface`, `text-muted`…), never raw hex. See `docs/DESIGN.md`.

## Working style

- **Small, focused commits** with [Conventional Commits](https://www.conventionalcommits.org/) (`feat(server): …`, `fix(app): …`, `docs: …`, `chore: …`, `test: …`).
- **Tests for server logic.** Every function in `src/server` gets unit tests (Vitest), including failure paths. Model calls are injected/mocked; no network in tests.
- Before saying a task is done, run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Report real output, including failures.
- Prefer boring, readable code over abstractions. No new dependency without a one-line justification in the PR/commit.
- When unsure about product, tone or safety, **stop and ask** rather than guess. Add the question to `docs/ARCHITECTURE.md#open-questions` if it's architectural.
- Log notable agent work and human decisions in `docs/PROCESS.md`.

## Commands

```bash
pnpm dev          # local dev server
pnpm lint         # biome check
pnpm format       # biome format --write
pnpm typecheck    # next typegen && tsc --noEmit
pnpm test         # vitest (no network)
pnpm build        # production build
pnpm eval         # golden-set evals: costs money, human-triggered only
```
