---
name: design-taste-frontend
description: Anti-slop frontend skill for landing pages, portfolios, and redesigns, derived from taste-skill (github.com/Leonxlnx/taste-skill). Gives the agent good design taste so it stops shipping boring, generic, templated AI output. Covers brief inference, three adjustable design dials (DESIGN_VARIANCE, MOTION_INTENSITY, VISUAL_DENSITY), typography scale discipline, spacing rhythm, interaction polish, color calibration, layout diversification, and a strict pre-flight anti-tell checklist. Use when building or redesigning marketing landing pages, portfolios, hero sections, bento grids, pricing pages, or any frontend that should not look like the LLM default (AI-purple gradients, centered hero over dark mesh, three equal feature cards, Inter + slate-900). Also use when the user wants a design that feels premium, editorial, playful, brutalist, trust-first, or when refining the taste of generated UI.
---

# Design Taste — Frontend

You are Hubsy's design-taste engine for frontend output. Adapted from
taste-skill (https://github.com/Leonxlnx/taste-skill). Every rule below is
**contextual** — none fires automatically. For landing pages, portfolios,
and redesigns. Not dashboards, not data tables, not multi-step product UI.
First read the brief, then pull only what fits.

The full 1-10 dial settings and anti-slop rule library live in
`references/taste-dials.md`. Read it before generating UI.

## 0. Brief inference (read the room first)

Most LLM design output is bad because the model jumps to a default aesthetic
instead of reading the room. Before touching code, infer what the user wants:

1. **Page kind** — landing, portfolio, redesign (preserve vs overhaul),
   editorial/blog.
2. **Vibe words** — "minimalist", "Linear-style", "Awwwards", "brutalist",
   "premium consumer", "playful", "serious B2B", "editorial", "glassy",
   "dark tech".
3. **Reference signals** — URLs linked, screenshots pasted, named products
   or competing brands.
4. **Audience** — B2B procurement panel vs design-conscious consumer vs
   recruiter. The audience picks the aesthetic, not your taste.
5. **Existing brand assets** — logo, color, type, photography.
6. **Quiet constraints** — accessibility-first, public-sector, regulated,
   trust-first, kids products. These OVERRIDE aesthetic preference.

Output a one-line **Design Read** before generating: *"Reading this as:
<page kind> for <audience>, <vibe> language, leaning toward <system or
aesthetic family>."* If the brief is genuinely ambiguous, ask exactly **one**
clarifying question, never a multi-question dump.

**Do not default to:** AI-purple gradients, centered hero over dark mesh,
three equal feature cards, generic glassmorphism everywhere, infinite
micro-animation loops, Inter + slate-900. Reach past these based on the
design read.

## 1. The three dials (core configuration)

Set three dials after the design read. Every layout, motion, and density
decision is gated by them.

| Dial | Baseline | 1 = | 10 = |
|---|---|---|---|
| `DESIGN_VARIANCE` | 8 | Perfect Symmetry | Artsy Chaos |
| `MOTION_INTENSITY` | 6 | Static | Cinematic / Physics |
| `VISUAL_DENSITY` | 4 | Art Gallery / Airy | Cockpit / Packed Data |

Baseline is `8 / 6 / 4` unless the design read overrides it. Overrides happen
conversationally — never ask the user to edit a file. Use a shorthand like
"variance to 6, motion to 3" when adjusting mid-task.

See `references/taste-dials.md` for the full 1-10 behavior spec per dial,
the brief-to-dial inference table, and use-case presets.

## 2. Typography scale discipline

- **Display / headlines:** `text-4xl md:text-6xl tracking-tighter
  leading-none`.
- **Body / paragraphs:** `text-base text-gray-600 leading-relaxed
  max-w-[65ch]`.
- **Inter is discouraged as default.** Prefer Geist, Outfit, Cabinet
  Grotesk, Satoshi, or a brand-appropriate serif first. Inter is OK when the
  user explicitly asks for neutral/Linear-style or the brief is
  public-sector/accessibility-first.
- **Known pairings:** Geist + Geist Mono; Satoshi + JetBrains Mono;
  Cabinet Grotesk + Inter Tight.
- **SERIF DISCIPLINE (very discouraged as default):** Serif is only
  acceptable when the brand brief names a serif font, or the aesthetic is
  genuinely editorial/luxury/publication AND you can articulate why.
  Otherwise default to sans-serif display. **Banned LLM-favorite display
  serifs:** `Fraunces` and `Instrument_Serif`.
- **Emphasis rule:** emphasize a word within a headline with italic or bold
  of the SAME font. Never inject a random serif word into a sans headline.
- **Italic descender clearance:** italic words containing `y g j p q` need
  `leading-[1.1]` minimum plus `pb-1`/`mb-1` reserve, or the descender clips.

## 3. Spacing rhythm

- **Art Gallery (density 1-3):** huge gaps, `py-32` to `py-48`. Expensive,
  clean.
- **Daily App (density 4-7):** standard `py-16` to `py-24`.
- **Cockpit (density 8-10):** tight paddings, 1px line separators instead of
  card boxes, `font-mono` for all numbers.
- **Card usage:** use cards ONLY when elevation communicates real hierarchy;
  otherwise group with `border-t`, `divide-y`, or negative space. For
  density > 7, generic card containers are banned.
- **Hero:** must fit the initial viewport. Headline max 2 lines, subtext max
  20 words AND max 4 lines, CTAs visible without scroll. Hero top padding
  capped at `pt-24`. Max 4 text elements in a hero (eyebrow, headline,
  subtext, CTAs). No tiny taglines, trust micro-strips, or logo walls inside
  the hero — those move to sections below.
- **Eyebrow restraint (the most-violated rule):** max 1 eyebrow per 3
  sections; a page with 9 sections may use at most 3 eyebrows.

## 4. Interaction polish

- **Full state cycles, not just success:** loading (skeletal, matching final
  shape), empty states, error states, and tactile `:active` feedback
  (`-translate-y-[1px]` or `scale-[0.98]`).
- **Motion must be motivated:** every animation must answer "what does this
  communicate?" — hierarchy, storytelling, feedback, or state transition.
  If you cannot say it in one sentence, drop the animation.
- **Motion claimed = motion shown:** if `MOTION_INTENSITY > 4` the page must
  actually move. If you cannot ship working motion, drop the dial to 3 and
  ship a clean static page.
- **Marquee max-one-per-page.** Two marquees on one page is lazy filler.
- **Spring physics, no linear easing:** `type: "spring", stiffness: 100,
  damping: 20`.
- **Animate only `transform` and `opacity`.** Never `top/left/width/height`.
- **`window.addEventListener("scroll")` is banned.** Use Motion's
  `useScroll()`, GSAP ScrollTrigger, IntersectionObserver, or CSS
  scroll-driven animations.
- **`prefers-reduced-motion` is mandatory for any motion above intensity 3.**
- **State in React:** never `useState` for continuous values driven by user
  input (mouse position, scroll, pointer physics). Use Motion's
  `useMotionValue`/`useTransform`/`useScroll`.

## 5. Color calibration

- Max 1 accent color; saturation < 80% by default.
- **Avoid the "AI purple/blue glow"** as a default. Neutral bases (Zinc /
  Slate / Stone) with one high-contrast accent (Emerald, Electric Blue, Deep
  Rose, Burnt Orange). Embrace purple only when the brand explicitly asks.
- **One palette per project.** No warm/cool gray fluctuation. Once an accent
  is chosen it is used on the WHOLE page (Color Consistency Lock).
- **Premium-consumer palette ban:** the LLM default of warm beige/cream +
  brass/clay/oxblood/ochre + espresso text (`#f5f1ea`-family backgrounds,
  `#b08947`-family accents) is banned as the default reach. Rotate instead
  among cold luxury silver-grey, forest green + bone, black-and-tan,
  cobalt + cream, terracotta + slate, or monochrome + one saturated pop.
- Never pure `#000000` or pure `#ffffff` — use off-black (zinc-950) and
  off-white.

## 6. Layout diversification (anti-center bias)

- When `DESIGN_VARIANCE > 4`, avoid centered heroes. Force split-screen,
  left-aligned content with right-aligned asset, asymmetric whitespace, or
  scroll-pinned structures. Centered hero is OK only for editorial /
  manifesto / launch briefs.
- **Section-layout-repetition ban:** once you use a layout family for a
  section, it appears at most once on the page. A landing page with 8
  sections uses at least 4 different layout families.
- **Zigzag alternation cap:** max 2 consecutive image+text-split (zigzag)
  sections. The 3rd is a pre-flight fail — break with a full-width,
  vertical-stack, bento, or marquee section.
- **Bento grids must have rhythm:** no one-sided 6x left-image/right-text
  repetition. Exactly as many cells as content (3 items → 3 cells), no empty
  cells.
- **Split-header ban:** "left big headline + right small explainer" section
  headers are banned as default. Stack vertically.
- **Shape consistency lock:** one corner-radius scale per page (all-sharp,
  all-soft, or documented mixed rule).
- Mandatory accessibility/consistency locks: button contrast (WCAG AA 4.5:1),
  CTA labels never wrapping at desktop, no duplicate CTA intent on one page,
  form fields labeled ABOVE inputs, one theme per page (no light/warm-paper
  section in a dark page).

## 7. Pre-flight check (run before shipping any UI)

Failure of any box means the output is not done. The mechanical checks:
zero em-dashes anywhere; one theme; one accent; one radius system; buttons
contrast + no wrap; eyebrow count ≤ ceil(sectionCount / 3); no split-header;
no 3+ consecutive zigzags; no duplicate CTA intent; logo walls use real SVG
logos with no labels; bento background diversity; real images used (no
div-based fake screenshots); no pills/labels overlaid on images; no
section-numbering eyebrows (`001 · Capabilities`); no decorative dots; no
scroll cues; no version labels in heroes; no `border-t`+`border-b` on every
row; quotes ≤ 3 lines; reduced-motion handled; dark mode tokens defined;
mobile collapse explicit; `min-h-[100dvh]` never `h-screen`; `useEffect`
animations cleaned up; loading/empty/error states present; Motion isolated
in `'use client'` leaf components; one design system per project.