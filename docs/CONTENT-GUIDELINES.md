# Content guidelines

Rules for every word the assistant can show: KB articles in `content/kb/`, fixed messages (emergency, crisis, medical, fallback) and UI dictionaries. The reader is a parent who may be exhausted, scared and reading on a phone at 2 a.m.

**Audience and scope:** English- and Spanish-speaking families **in the United States** ([ADR 0012](decisions/0012-us-scope-and-crisis-contacts.md)).

## Scope: practical and logistical only

Write about the *practical side* of treatment: hospital days (what to pack, getting there, overnight stays), money and work (asking about financial help, time off work), family and school (talking with your child and siblings, staying connected to school), looking after yourself, and **how to talk with the care team** (preparing questions, keeping a notebook, knowing when to call).

Do **not** write about diagnosis, prognosis, treatments, side effects, medicines, nutrition plans, or anything a clinician should decide.

## Medical boundary

- **No medical claims.** No statistics, survival rates, causes, or "this helps with…" statements.
- **No dosages, no medicine names as advice, no symptom triage.**
- For any clinical topic, the answer is always: **ask your care team**, and help the parent phrase the question. Example: *"That's a question for your child's care team. You could ask: 'What should we watch for at home after this treatment, and who do we call at night?'"*
- If unsure whether a topic is clinical, treat it as clinical.
- **Medical questions to the assistant get a fixed template** ([ADR 0011](decisions/0011-medical-fixed-template.md)), never a generated answer. The template links the article `questions-for-your-care-team`.
- **"When to call" articles don't list symptoms.** They say the care team will give you a list of urgent signs, to keep it visible, to call when in doubt, and to call 911 in an emergency. Lumi never writes its own symptom list.

## Voice

- **Warm, plain, direct.** Short sentences. One idea per paragraph. Lead with the answer.
- **Concrete over comforting.** "Ask the nurse station for a parking validation" beats "We know this is hard."
- **No pity, no drama, no forced positivity.** No "brave little warriors", no "journey", no "everything happens for a reason".
- **Respect the reader's competence.** They are the expert on their child.
- **Say what you don't know.** "I don't have a guide on that yet" is a good answer.
- **Second person** ("you", "tú"). Gender-neutral about the child where possible ("your child", "tu hijo o hija").
- Target reading level: ~grade 6–8. Avoid jargon. If a hospital term is unavoidable, explain it in a few words.

## Spanish

- **Neutral Latin American Spanish, using "tú".** Avoid regionalisms ("carro" vs "coche": prefer neutral terms like "vehículo" or rephrase) and avoid "vosotros".
- **Written, not machine-translated.** Draft with help if needed, but a human must review it for naturalness. Read it out loud.
- Use inclusive but readable forms: "tu hijo o hija", not "hij@" or "hijx".

## Parity between EN and ES

- Every article exists in both languages with the **same `id`** and the same `category`.
- Same facts, same steps, same boundaries. Wording may differ to sound natural.
- Update both in the same commit and bump `reviewedAt` in both.

## Truthfulness and the fictional world

- Lumi is fictional. **Don't invent real-world facts presented as true** (specific laws, benefit amounts, programme names, eligibility rules). For leave, school rights or insurance, say who to ask (employer HR, the school, the insurance plan, the hospital social worker), not what the law says.
- **No real organisations, hospitals or phone numbers.** Use generic institutions and descriptions: "your hospital's emergency line", "the social worker at your hospital", "your employer's HR team", "your insurance plan".
- **One narrow exception ([ADR 0005](decisions/0005-no-conversation-storage.md)):** Real organizations are not used or imitated, except naming the AI data processor (OpenAI) in privacy disclosures, and the public 911/988 services in fixed safety copy. "OpenAI" may appear only in `help.processingNotice`, `notebook.processingNotice` and the `how-lumi-can-help` article. Tests enforce this.
- **Allowed numbers:** **911** anywhere it helps. **988** (988 Suicide & Crisis Lifeline, a public US service) **only** in the fixed safety copy (`safety.*` and the crisis banner in the dictionaries) and, in the KB, only as the exact crisis line copied from `safety.crisisLine`. Outside the US: "contact your local emergency services". Tests enforce this.
- **No names, no testimonials, no quotes from "families".** No invented stories.

## Article format

See [`content/kb/README.md`](../content/kb/README.md) for frontmatter. Body guidance:

- **250–450 words** (checked by tests). Title phrased as the parent's question or task ("Your first days at the hospital: what to bring").
- Short sections with `##` headings.
- Open with a 1–2 sentence answer, then a short list of steps or tips.
- End with "who to ask" when relevant (care team, social worker, school).
- One topic per article. If you're writing "also…", it's probably a second article.

## Imagery and UI copy

Follow [DESIGN.md](DESIGN.md). No stock photos of sick children. Placeholders must say they're placeholders.

## Risk level

Every article has `risk: standard | high` in its frontmatter. Mark **`high`** anything that touches symptoms, when to seek care, the clinical boundary, medicines (even "the list your team gives you"), talking to a child about illness, or emotional crisis. **Felipe reviews every `high` article personally**, and again on every edit.

## Automated checks (CI gate)

`pnpm test` fails if any article breaks these. They catch slips; they don't replace the checklist below.

- Frontmatter matches the schema; `lang` matches the folder; ids are unique.
- Every EN id has an ES pair with the same `category` and `risk`, and vice versa.
- Body is 250–450 words.
- No dosage patterns ("5 ml", "200mg", "a tablet", "give it every 4 hours", "take … twice daily": the structural gate in [ADR 0015](decisions/0015-structural-output-checks.md); KB text has to pass it too), no "cure"/"guarantee" (EN/ES), no "journey"/"warrior".
- No phone numbers except 911, and 988 only inside the approved crisis line.
- "OpenAI" only in the privacy disclosures (`help.processingNotice`, `notebook.processingNotice`, `how-lumi-can-help`).
- The only other phone number in the UI is the footer's fictional demo contact (`footer.contactPhone`, `555-01xx`), never in safety or fallback copy (ADR 0012).
- UI copy passes the same dosage gate as the KB, so mock schedules use time-of-day words ("Mondays, early evening"), not clock times, and age ranges are written "ages 6 to 12".

## Review checklist (per article)

- [ ] Practical/logistical only; any clinical point redirects to the care team
- [ ] No numbers except 911 (and 988 only in the approved line); no real organisations; no names
- [ ] EN and ES both present, same `id`, same facts
- [ ] Spanish read aloud by a human, uses "tú", neutral vocabulary
- [ ] `risk` set correctly; `high` articles reviewed by Felipe
- [ ] `reviewedAt` updated
