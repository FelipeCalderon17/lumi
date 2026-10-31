# Design — Lumi

## Direction: "a lantern on the night table"

Lumi is the small light you leave on in a hospital room. The interface should feel like **warm lamplight in a dark, quiet room**: calm, low-glare, with one warm point of focus at a time. It isn't the clinical white-and-blue of a hospital, and it isn't the pastel-and-balloons of "kids' charity". It's hopeful through warmth, not through cheerfulness.

**What makes it recognisable:** deep ink-indigo night, one amber "firefly" glow used sparingly (the mark, the main action, focus rings), a soft serif headline voice, and generous, legible body text.

**The 2 a.m. test**, applied to every screen:

- Readable by tired eyes on a phone in a dark room: large body text, high contrast, no glare.
- One obvious next action. Nothing blinks, nothing auto-plays, nothing celebrates.
- The emergency (911) and crisis (988) lines are always visible on the help page and work without JavaScript or the AI.
- Nothing on screen makes the parent feel watched, sold to, or pitied.

## Colour

Two themes, chosen by `prefers-color-scheme`, with a manual toggle in the header that's remembered on the device (applied before paint):

- **Night** (dark): the home palette, what most late-night visits will see.
- **Dawn** (light): warm paper, never pure white backgrounds.

Components use **semantic tokens only** (`bg-surface`, `text-muted`, `text-glow`…). Tailwind's default palette is removed in `globals.css` (`--color-*: initial`) so off-brand colours can't creep in.

| Token | Role | Night | Dawn |
|---|---|---|---|
| `bg` | Page background | `#12112A` | `#FBF6EC` |
| `surface` | Cards, input | `#1C1A3D` | `#FFFFFF` |
| `raised` | Banners, hover | `#272452` | `#F3EADA` |
| `line` | Borders, dividers | `#3A3670` | `#E2D6C0` |
| `text` | Body and headings | `#F4EEDF` | `#1E1B3A` |
| `muted` | Secondary text | `#B4AED6` | `#5A5478` |
| `glow` | Accent text, focus ring | `#F6BE4F` | `#8A5200` |
| `ember` | Emergency / alert | `#FF9A85` | `#B3321F` |
| `sage` | "Grounded" / citations | `#8ED7B8` | `#2E6B55` |
| `lantern` | Primary button fill (both themes) | `#F6BE4F` | `#F6BE4F` |
| `on-lantern` | Text on lantern | `#1E1B3A` | `#1E1B3A` |

### Contrast (WCAG 2.2, computed)

All text pairings pass **AA (4.5:1)**; most pass AAA (7:1).

| Pair | Night | Dawn |
|---|---|---|
| text on bg / surface / raised | 15.9 / 14.4 / 12.4 | 15.3 / 16.5 / 13.8 |
| muted on bg / surface / raised | 8.8 / 7.9 / 6.8 | 6.6 / 7.1 / 5.9 |
| glow on bg / surface / raised | 10.9 / 9.8 / 8.5 | 5.9 / 6.4 / 5.4 |
| ember on bg / surface / raised | 9.0 / 8.1 / 7.0 | 5.8 / 6.2 / 5.2 |
| sage on bg / surface / raised | 11.0 / 9.9 / 8.6 | 5.8 / 6.3 / 5.3 |
| on-lantern on lantern | 9.7 | 9.7 |

Rules:

- Amber `#F6BE4F` is **never used as text on dawn** (too light). Dawn uses the darker `glow` `#8A5200`.
- Colour never carries meaning alone: emergency has a heading and an icon/dot as well as `ember`. Citations are labelled, not just green.
- Amber is used sparingly: the mark, one primary action per view, focus rings. If everything glows, nothing does.

## Typography

| Role | Typeface | Why |
|---|---|---|
| Display / headings | **Fraunces** (variable, `SOFT` + `opsz` axes) | A soft, old-style serif: storybook warmth without being childish. Optical sizing keeps large headlines elegant. |
| Body / UI | **Atkinson Hyperlegible Next** | Designed for low-vision legibility, with distinct letterforms (Il1, 0O). Good for tired eyes and for both EN and ES diacritics. |

Loaded with `next/font` (self-hosted at build, no runtime requests to Google).

- Body: **18px** (`--text-base: 1.125rem`), line-height 1.65, measure ≤ ~70ch.
- Headings: tight tracking, `text-balance`. Display sizes 36–72px. The hero title is the only very large type on a page.
- Never set body copy in the serif; never in all-caps beyond short eyebrows.

## Space, shape, layout

- 4px base grid; Tailwind's spacing scale. Generous vertical rhythm. Pages breathe.
- Max content width `max-w-5xl` (layout), `max-w-2xl` for reading.
- Radius: `rounded-soft` (14px) for cards, `rounded-pill` for buttons and chips. No sharp corners, no heavy shadows. Depth comes from the background halo and a soft amber glow on the primary action only.
- Placeholders (donate, volunteer) use **dashed** borders: visibly "not built yet", honest about the prototype.
- Mobile first. Touch targets ≥ 44px. The chat input sits within thumb reach.

## Motion

- Motion is **slow and small**: a gentle flicker on the firefly mark (4.5s), soft hover lifts (≤ 2px), 200–300ms colour transitions with `--ease-lumi`.
- Answers appear **in one piece, once checked** (ADR 0010). While waiting, show one calm, static line ("Looking through our family guides…") with at most a slow, subtle glow; no typewriter effects, no bouncing dots.
- **`prefers-reduced-motion: reduce` turns all animation and transitions off** (global rule in `globals.css`).
- Nothing flashes. Nothing moves while the parent is reading.

## Imagery

- **Yes:** abstract light (halos, a few firefly dots), simple line illustration (lantern, window at night, a paper boat), textures of paper and dusk.
- **No:** stock photos of sick or bald children, hospital beds, IV lines, crying parents, hands-holding-hands clichés, ribbons as decoration, cartoons that infantilise parents.
- No photos of real people at all in the prototype (no consent to show them, and no fake ones either).
- All decorative graphics are `aria-hidden`.

## Voice & tone

Full rules: [CONTENT-GUIDELINES.md](CONTENT-GUIDELINES.md). In short:

- **Like a kind, experienced nurse at the night desk:** calm, concrete, honest about limits.
- Lead with the answer. Short sentences. "You" / "tú".
- No pity ("we're so sorry for what you're going through" on every screen), no hype ("AI-powered!"), no "journey" or "warriors".
- Lumi says "I don't have that yet" plainly and always offers a human next step.
- Emergency copy is the one place that is **direct and imperative**: "Call 911 now."

## Accessibility checklist

- [x] AA contrast on every text pair (table above)
- [x] Visible focus ring (3px `glow`) on every interactive element
- [x] `lang` on `<html>` matches the page; the language switch link has `hreflang`/`lang`
- [x] Answer region is `aria-live="polite"` and announces the progress line once, then the complete answer; emergency is not hidden behind animation
- [x] All motion off under `prefers-reduced-motion`
- [ ] Works at 200% zoom and 320px width (checked at 390px with no horizontal overflow on any page; 320px and 200% zoom not yet checked)
