# Content guidelines

Rules for every word the assistant can show: KB articles in `content/kb/`, fixed messages (emergency, crisis, fallback) and UI dictionaries. The reader is a parent who may be exhausted, scared and reading on a phone at 2 a.m.

## Scope: practical and logistical only

Write about the *practical side* of treatment: hospital days (parking, meals, what to pack, overnight stays), paperwork and money (keeping records, asking about financial help, time off work), school and siblings, daily life at home, looking after yourself, and **how to talk with the care team** (preparing questions, keeping a notebook).

Do **not** write about diagnosis, prognosis, treatments, side effects, medicines, nutrition plans, or anything a clinician should decide.

## Medical boundary

- **No medical claims.** No statistics, survival rates, causes, or "this helps with…" statements.
- **No dosages, no medicine names as advice, no symptom triage.**
- For any clinical topic, the answer is always: **ask your care team**, and help the parent phrase the question. Example: *"That's a question for your child's care team. You could ask: 'What should we watch for at home after this treatment, and who do we call at night?'"*
- If unsure whether a topic is clinical, treat it as clinical.

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

- Lumi is fictional. **Don't invent real-world facts presented as true** (specific laws, benefit amounts, programme names).
- **No real organisations, hospitals or phone numbers.** The only number allowed is the generic **911**. Use descriptions: "your hospital's emergency line", "the social worker at your hospital".
- **No names, no testimonials, no quotes from "families".** No invented stories.

## Article format

See [`content/kb/README.md`](../content/kb/README.md) for frontmatter. Body guidance:

- 150–400 words. Title phrased as the parent's question or task ("Packing for a hospital stay").
- Open with a 1–2 sentence answer, then a short list of steps or tips.
- End with "who to ask" when relevant (care team, social worker, school).
- One topic per article. If you're writing "also…", it's probably a second article.

## Imagery and UI copy

Follow [DESIGN.md](DESIGN.md). No stock photos of sick children. Placeholders must say they're placeholders.

## Review checklist (per article)

- [ ] Practical/logistical only; any clinical point redirects to the care team
- [ ] No numbers except 911; no real organisations; no names
- [ ] EN and ES both present, same `id`, same facts
- [ ] Spanish read aloud by a human, uses "tú", neutral vocabulary
- [ ] `reviewedAt` updated
