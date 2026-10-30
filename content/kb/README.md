# Knowledge base

The assistant answers **only** from these articles. Rules for writing them: [docs/CONTENT-GUIDELINES.md](../../docs/CONTENT-GUIDELINES.md).

```
content/kb/
  en/<id>.md
  es/<id>.md   ← same <id> as the English article (parity is checked in tests)
```

Each file is Markdown with YAML frontmatter, validated by `ArticleFrontmatterSchema` in `src/server/knowledge`:

```markdown
---
id: first-days-at-the-hospital   # kebab-case, identical in en/ and es/
lang: en                         # en | es — must match the folder
title: "Your first days at the hospital: what to bring"
category: hospital-logistics     # hospital-logistics | money-and-work | family-and-school
                                 # | talking-with-the-care-team | caring-for-yourself | about-lumi
risk: standard                   # standard | high — high = symptoms, clinical boundary, medicines,
                                 # talking to a child about illness, emotional crisis. Felipe reviews.
reviewedAt: 2026-10-30           # date of the last human review
---

Short, practical body. Plain language. No medical advice.
```

At load time articles are sorted by `id` and numbered `[1]`, `[2]`, … The model cites those handles; `src/server/validate` checks every citation maps to a real article (integrity, not grounding: see ARCHITECTURE.md).

`questions-for-your-care-team` is special: the fixed medical template links it (ADR 0011). Don't rename it.

Checked in CI by `src/server/knowledge/kb-content.test.ts`: schema, unique ids, EN/ES parity, 250–450 words, banned patterns. Rules: CONTENT-GUIDELINES § Automated checks.

Spanish articles are written in Spanish (not machine-translated at runtime) — see ADR 0004.
