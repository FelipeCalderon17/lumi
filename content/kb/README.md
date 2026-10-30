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
id: parking-and-meals            # kebab-case, identical in en/ and es/
lang: en                         # en | es — must match the folder
title: Parking and meals during a hospital stay
category: hospital-logistics     # hospital-logistics | money-and-paperwork | school-and-siblings
                                 # | daily-life | caring-for-yourself | talking-with-the-care-team
reviewedAt: 2026-10-30           # date of the last human review
---

Short, practical body. Plain language. No medical advice.
```

At load time articles are sorted by `id` and numbered `[1]`, `[2]`, … The model cites those handles; `src/server/validate` checks every citation maps to a real article.

Spanish articles are written in Spanish (not machine-translated at runtime) — see ADR 0004.
