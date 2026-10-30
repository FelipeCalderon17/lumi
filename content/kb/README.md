# Knowledge base

The assistant answers **only** from these articles. Rules for writing them: [docs/CONTENT-GUIDELINES.md](../../docs/CONTENT-GUIDELINES.md).

```
content/kb/
  en/<id>.md
  es/<id>.md   ← same <id> as the English article (parity is checked in tests)
```

Each file is Markdown with a flat frontmatter block (`key: value` per line, quote values that contain a colon, no inline comments: the comments below are only for this README), parsed by `parseArticleFile` and validated by `ArticleFrontmatterSchema` in `src/server/knowledge`:

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

## Current articles (12 per language)

| id | Category | Risk |
|---|---|---|
| `first-days-at-the-hospital` | hospital-logistics | standard |
| `getting-there-and-staying-nearby` | hospital-logistics | standard |
| `talking-with-your-child` | family-and-school | **high** |
| `talking-with-siblings` | family-and-school | standard |
| `school-during-treatment` | family-and-school | standard |
| `questions-for-your-care-team` | talking-with-the-care-team | **high** (medical template target) |
| `when-to-call-your-care-team` | talking-with-the-care-team | **high** |
| `family-notebook` | talking-with-the-care-team | **high** |
| `paying-for-care` | money-and-work | standard |
| `work-and-caregiving` | money-and-work | standard |
| `taking-care-of-yourself` | caring-for-yourself | **high** (contains the 988 line) |
| `how-lumi-can-help` | about-lumi | standard |

We add articles only when the golden set or the gaps view shows a real need.
