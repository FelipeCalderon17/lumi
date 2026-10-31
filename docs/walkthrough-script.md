# Lumi walkthrough: narration script

Final script of the walkthrough video (4:28, 1920×1080). Narration: OpenAI `gpt-4o-mini-tts`, voice `sage`. Everything on screen is the live site (https://lumi-production-fa66.up.railway.app) used in a real browser, with real model answers. Captions are burned in and also included as a soft subtitle track. Numbers are spelled out for the voice and shown as digits in the captions. How it was produced: [PROCESS.md § Walkthrough video](PROCESS.md#walkthrough-video-2026-10-31).

## 1. Landing (0:00)

*On screen:* Landing page (/en), night theme. Hover the headline, scroll to "Three ways we hold the light", back up to the 911/988 strip.

> Lumi is a prototype by Felipe Calderón: a bilingual website for a fictional foundation that supports families of children with cancer.
>
> It's built for a parent awake at 2 a.m., who may be more at home in Spanish.
>
> Three goals: support families, raise funds and recruit volunteers. Support is where Lumi goes deep.
>
> On every page, a calm strip keeps 911 and 988 in reach, even without JavaScript.

## 2. Ask Lumi: a practical question (0:34)

*On screen:* Ask Lumi. The processing notice; tap the "What to bring" chip; the calm "Looking through our family guides…" line; the answer with "From these guides".

> Ask Lumi starts with a short notice: the question goes to OpenAI, and the conversation isn't saved.
>
> While Lumi looks, there's one calm line. Nothing streams in.
>
> The answer comes only from Lumi's family guides, and it's checked before it's shown, so nothing appears and then gets taken back. Its guides are listed below.

## 3. A medical question (1:03)

*On screen:* Type "Should I give her ibuprofen for the pain?"; the fixed medical copy; click "+ Add to my notebook".

> Medical questions are handled differently.
>
> There's no generated advice. Lumi shows fixed, reviewed copy that points to the care team, and the parent can add the question to their notebook.

## 4. Emergency and crisis (1:20)

*On screen:* Type "He isn't breathing": the emergency card with Call 911 under the heading. Type "I can't do this anymore": the crisis card, 988 first.

> Some messages can't wait. The emergency card appears at once, with Call 911 right under the heading, from rules that don't wait on AI.
>
> For emotional crisis, 988 comes first, to call or text, then 911.

## 5. Not covered: no guide yet (1:40)

*On screen:* Type "Can our dog visit my son in the hospital?": "I don't have a guide on that yet". "Yes, share it": editable preview, disclosure, consent box, Save.

> Now, a question none of the guides cover.
>
> Lumi says so plainly, and suggests checking with the nurse or care team.
>
> The parent can share the question with the team. They see exactly what would be saved, and can edit it first.
>
> Nothing is stored without consent. That's how the team learns which guide to write next.

## 6. Spanish (2:12)

*On screen:* Switch to Español; type "¿Cómo hablo con mis otros hijos sobre esto?"; a Spanish answer with "De estas guías".

> Everything works in Spanish too, with guides written for each language.
>
> A natural Spanish answer, with its guides listed below.

## 7. My notebook (2:30)

*On screen:* Back to English, My notebook: the medical question is there. Type two notes, "Prepare my page": notes by topic, verbatim, with dates. Print / Copy.

> My notebook is a private place to write things down. The question from earlier is already here.
>
> Notes stay in this browser, on this device. Lumi doesn't store them.
>
> Before an appointment, the notes are sorted by topic. The AI only picks a topic and never rewrites, so every note stays in the parent's own words, with its date.
>
> Ready to print, copy or share.

## 8. Quick tour (3:07)

*On screen:* Guides library, then the Community, Volunteer and Donate demo pages (Demo badges).

> The guides Lumi answers from can be read on their own.
>
> Community, Volunteer and Donate are clearly labelled demos. No testimonials, and nothing is sent.

## 9. Staff view (3:23)

*On screen:* /en/staff: sign in (passcode shown as dots); the dog question with language and topic; usage with cost derived from token counts.

> Behind a passcode, the staff view shows the questions parents chose to share.
>
> The dog question is here, with its language and topic.
>
> Usage is stored as token counts, and cost is derived from them. In the evals, that came to about $0.22 per 1,000 answer-step requests, with caching.

## 10. On a phone (3:47)

*On screen:* Phone (390×844): the landing, then Ask Lumi with "He isn't breathing" and the emergency card.

> On a phone, it's the same calm page, with the crisis lines at the top.
>
> And an emergency gets the same instant answer, with Call 911 one tap away.

## 11. Close (4:00)

*On screen:* Back on the desktop landing; scroll to the Ask Lumi section and back to the hero. Ends on "A little light for the long nights."

> Felipe made every product, safety and tone decision. Claude agents built it, and a Codex reviewer checked every phase.
>
> In the evals, safety scored 100% on every model, for $1.15 of a $2 budget. Every tradeoff is written down in the README.
>
> Lumi. A little light for the long nights.


