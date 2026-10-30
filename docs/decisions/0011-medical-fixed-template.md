# 0011 — Medical questions get a fixed, reviewed template, not generation

**Status:** Accepted · 2026-10-30 · *From Codex review 1 (blocker B2).*

## Context
The first design sent `medical` questions to the answer model in a "medical prep" mode: no advice, but help drafting questions for the care team. Even with good rules, that's free generation next to clinical topics. Citation integrity can't tell whether a generated sentence quietly became advice ("that's usually normal after…"). This is the riskiest place to generate text.

## Decision
- When the router's resolved category is `medical`, the pipeline makes **no answer call**. It returns a terminal `medical` event, and the UI renders fixed, reviewed copy (`safety.medical` in the dictionaries):
  - *"That's a question for your child's care team."* Lumi doesn't give medical advice. If it can't wait, call the after-hours number your care team gave you. If it's an emergency, call 911.
  - A link to the curated KB article **"Questions to ask your care team"** (`questions-for-your-care-team`, `risk: high`, in EN and ES). Tests check that it exists in both languages.
- Precedence still applies: a message that is both medical and urgent goes to the emergency path.

## Consequences
- No generated text on the clinical path at all, so there's nothing to hallucinate.
- Cheaper: medical questions cost one router call.
- Less tailored: the parent gets the same helpful template whatever they asked. The linked article does the work of helping them phrase their question.
- Router misclassification matters more. A medical question routed as `practical` would reach generation, where the policy still forbids advice and the evals check the boundary with judge + `noDosage` + `mentionsCareTeam`.

## Alternatives
- **Generated "medical prep" answers.** Rejected: free generation on the riskiest path.
- **Refuse medical questions with no help.** Rejected: unkind and unhelpful. The template plus the article gives a clear next step.
