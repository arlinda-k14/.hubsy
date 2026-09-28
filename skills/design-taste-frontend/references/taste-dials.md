# Taste Dials: 1-10 Settings + Anti-Slop Rules

Reference summary of the three design dials from taste-skill
(github.com/Leonxlnx/taste-skill). Baseline is `DESIGN_VARIANCE 8 /
MOTION_INTENSITY 6 / VISUAL_DENSITY 4` unless the design read overrides it.

## The dials

| Dial | 1 = | 10 = |
|---|---|---|
| `DESIGN_VARIANCE` | Perfect Symmetry | Artsy Chaos |
| `MOTION_INTENSITY` | Static | Cinematic / Physics |
| `VISUAL_DENSITY` | Art Gallery / Airy | Cockpit / Packed Data |

## DESIGN_VARIANCE (1-10)

- **1-3 (Predictable):** symmetric 12-col CSS Grid with equal fr-units, equal
  paddings, centered alignment.
- **4-7 (Offset):** `margin-top: -2rem` overlaps, mixed image aspect ratios
  (4:3 next to 16:9), left-aligned headers over center-aligned data.
- **8-10 (Asymmetric):** masonry, fractional grid columns
  (`grid-template-columns: 2fr 1fr 1fr`), massive empty zones (`padding-left:
  20vw`).
- **MOBILE OVERRIDE:** for variance 4-10, asymmetric layouts above `md:` MUST
  collapse to strict single-column (`w-full`, `px-4`, `py-8`) below 768px.
- **Anti-center bias:** variance > 4 → avoid centered heroes. Use split-screen,
  left-content/right-asset, asymmetric whitespace, or scroll-pinned layouts.
  Centered hero OK only for editorial/manifesto/launch briefs.

## MOTION_INTENSITY (1-10)

- **1-3 (Static):** no automatic animations. CSS `:hover`/`:active` only.
  Reduced-motion is the default mode anyway.
- **4-7 (Fluid CSS):** `transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1)`,
  `animation-delay` cascades for load-ins. Focus on `transform` and
  `opacity`.
- **8-10 (Advanced Choreography):** scroll-triggered reveals, parallax,
  scroll-driven animation (CSS `animation-timeline` or GSAP ScrollTrigger),
  Motion hooks. **NEVER `window.addEventListener('scroll')`** — hard ban.
- **Mandatory:** any motion above intensity 3 MUST honor
  `prefers-reduced-motion`. Motion claimed = motion shown: if intensity > 4
  the page must actually move. Spring physics (`stiffness: 100, damping: 20`),
  never linear easing. Magnetic micro-physics requires `useMotionValue` /
  `useTransform`, never `useState`. Marquee max-one-per-page.

## VISUAL_DENSITY (1-10)

- **1-3 (Art Gallery):** lots of whitespace, huge section gaps (`py-32` to
  `py-48`). Expensive, clean.
- **4-7 (Daily App):** standard app spacing (`py-16` to `py-24`).
- **8-10 (Cockpit):** tight paddings, no card boxes, 1px lines separate data,
  mandatory `font-mono` for all numbers.

## Brief-to-dial inference

| Signal | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| "minimalist / clean / calm / editorial / Linear-style" | 5-6 | 3-4 | 2-3 |
| "premium consumer / Apple-y / luxury / brand" | 7-8 | 5-7 | 3-4 |
| "playful / wild / Dribbble / Awwwards / experimental / agency" | 9-10 | 8-10 | 3-4 |
| "landing / portfolio / marketing site (default)" | 7-9 | 6-8 | 3-5 |
| "trust-first / public-sector / regulated / a11y-critical" | 3-4 | 2-3 | 4-5 |
| "redesign - preserve" | match existing | +1 | match existing |
| "redesign - overhaul" | +2 | +2 | match existing |

## Use-case presets

| Use case | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| Landing (SaaS, mainstream) | 7 | 6 | 4 |
| Landing (agency / creative) | 9 | 8 | 3 |
| Landing (premium consumer) | 7 | 6 | 3 |
| Portfolio (designer / studio) | 8 | 7 | 3 |
| Portfolio (developer) | 6 | 5 | 4 |
| Editorial / blog | 6 | 4 | 3 |
| Public-sector service | 3 | 2 | 5 |
| Redesign - preserve | match | match+1 | match |
| Redesign - overhaul | +2 | +2 | match |

## Anti-slop rules (AI tells to avoid)

### Typography
- Inter as default: discouraged — use Geist, Outfit, Cabinet Grotesk,
  Satoshi, or brand-appropriate serif first.
- No oversized H1s that just scream; control hierarchy with weight + color.
- Serif only for editorial/luxury/publication; never as default for creative
  agencies or premium-consumer. Banned LLM display serifs: `Fraunces`,
  `Instrument_Serif`. Do not reuse the same serif across consecutive projects.
- Italic descenders (`y g j p q`) need `leading-[1.1]` + `pb-1` reserve.
- Not mixing serif emphasis into a sans headline — use italic/bold of the
  same font.

### Color
- No AI-purple/blue glow as default. One accent, saturation < 80%.
- No beige+brass+espresso premium-consumer default (`#f5f1ea` backgrounds,
  `#b08947` accents). Rotate among cold luxury / forest / black-and-tan /
  cobalt+cream / terracotta+slate / mono + one pop.
- No pure black `#000000`, no pure white `#ffffff`.

### Layout
- No three equal feature cards, no centered hero over dark mesh by default
  (variance > 4).
- No split-header (left headline + right explainer paragraph).
- No zigzag alternation 3+ times consecutively.
- No eyebrow above every section: max 1 per 3 sections.
- No section-numbering eyebrows (`001 · Capabilities`, `06 · how it works`).
- No pills/labels overlaid on images (`Plate · Brand`, `Field notes - journal`).
- No photo-credit captions as decoration.
- No version footers (`v1.4.2`, `Build 0048`) or hero version labels
  (`V0.6, BETA, INVITE-ONLY`) unless it's a launch.
- No micro-meta-sentences under eyebrows.
- No decorative text strip at hero bottom (`BRAND. MOTION. SPATIAL.`).
- No floating top-right sub-text in section headings.
- No decorative dots (zero by default, only for real semantic state).
- No locale/city/time/weather strips unless genuinely place-focused.
- No scroll cues (`Scroll`, `↓ scroll`, `Scroll to explore`).

### Interaction
- No infinite-loop micro-animations everywhere; motion must be motivated.
- No `window.addEventListener('scroll')` or `window.scrollY` state math.
- No `useState` for pointer/scroll/motion values.
- No `h-screen` for heroes — use `min-h-[100dvh]`.
- No custom mouse cursors (outdated, a11y- and perf-hostile).

### Content & structure
- No div-based fake screenshots / hand-rolled "product previews" (banned).
- No placeholder-as-label in forms. No text-only minimalism — real images
  required (gen-tool first, then Picsum-seed, then labeled placeholder slots).
- No plain-text wordmark logo walls — real SVG logos (Simple Icons / devicon)
  or generated SVG monograms, no category labels below logos.
- No 20-row spec tables with `border-b` under every row. Use 2-col card grid,
  scroll-snap pills, grouped chunks, or featured-vs-rest.
- No long `<ul>` for > 5 items — use 2-col split, card grid, tabs, carousel,
  or marquee.
- No duplicate CTA intent ("Get in touch" + "Let's talk" both on a page).
- No CTA labels wrapping to 2+ lines at desktop.
- No Jane Doe / Acme placeholders in copy without real data.
- No fake-precise numbers (92%, 4.1x, 13.4 lb) unless real or labeled mock.
- No AI-hallucinated copy — re-read every visible string before shipping.
- Quotes max 3 lines, real typographic quotes, attribution with name + role.
- Zero em-dashes (`—`) anywhere visible — non-negotiable.

### Consistency locks (pre-flight, mechanical)
- Page Theme Lock: one theme (light/dark/auto) per page; no section flips.
- Color Consistency Lock: one accent used identically across all sections.
- Shape Consistency Lock: one corner-radius system applied everywhere.
- Button/form contrast: WCAG AA (4.5:1 body, 3:1 large text).
- One design system per project; never mix Material + shadcn + Fluent.
- Use official packages (`@fluentui/react-components`, `@carbon/react`,
  `govuk-frontend`, `uswds`, `@radix-ui/themes`, shadcn/ui) rather than
  hand-rolling an official system's CSS.