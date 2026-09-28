# UX Framework: Component Structures + Conversion Layouts

Reference for ui-ux-pro-max-skill (github.com/nextlevelbuilder/ui-ux-pro-max-skill).
Summarizes core component token structures and conversion-focused landing
layout patterns. Pair with SKILL.md for the full priority table, interaction,
responsive, and WCAG rules.

## Part A — Core component structures (design tokens)

Every component is built from three token layers: **primitives** (raw scale
values), **semantic** (purpose tokens like `--color-primary`), and
**component** (per-component vars bound to semantic tokens). Never put raw
hex straight into components.

### Primitive scales (recommended defaults)

- **Color:** neutral scale + single accent; dark mode uses desaturated/
  lighter tonal variants, never inverted colors.
- **Space:** 4/8dp rhythm — `--space-0-5,1,1-5,2,2-5,3,4,5,6,8`; section tiers
  16/24/32/48.
- **Radius:** `--radius-sm,md,lg,full`.
- **Type:** `--font-size-xs,sm,base,lg,xl,2xl,3xl`; body line-height 1.5-1.75,
  min 16px on mobile.
- **Shadow/elevation:** `--shadow-default,md,lg` — one consistent scale for
  cards, sheets, modals.

### Semantic tokens (reference set)

```
--color-background       --color-foreground       --color-primary / -foreground
--color-primary-hover    --color-secondary / -fg  --color-accent
--color-muted / -fg      --color-card / -fg       --color-input
--color-border           --color-ring             --color-error / -fg
--color-destructive / -fg / -hover
```

### Component token maps

#### Button
```css
--button-bg: var(--color-primary);        --button-fg: var(--color-primary-foreground);
--button-hover-bg: var(--color-primary-hover);  --button-active-bg: var(--color-primary-active);
--button-secondary-bg/-fg/-hover-bg;      --button-outline-border/-fg/-hover-bg(accent);
--button-ghost-fg/-hover-bg;              --button-destructive-bg/-fg/-hover-bg;
--button-padding-x: var(--space-4);       --button-padding-y: var(--space-2);
--button-padding-x-sm: var(--space-3);    --button-padding-y-sm: var(--space-1-5);
--button-padding-x-lg: var(--space-6);    --button-padding-y-lg: var(--space-3);
--button-radius: var(--radius-md);        --button-font-size: var(--font-size-sm);
--button-font-weight: var(--font-weight-medium);
```

#### Input
```css
--input-bg: var(--color-background);   --input-border: var(--color-input);
--input-fg: var(--color-foreground);   --input-placeholder: var(--color-muted-foreground);
--input-focus-border: var(--color-ring);  --input-focus-ring: var(--color-ring);
--input-error-border/-fg: var(--color-error);
--input-disabled-bg: var(--color-muted);  --input-disabled-fg: var(--color-muted-foreground);
--input-padding-x: var(--space-3);  --input-padding-y: var(--space-2);
--input-radius: var(--radius-md);    --input-font-size: var(--font-size-sm);
```

#### Card
```css
--card-bg: var(--color-card);  --card-fg: var(--color-card-foreground);  --card-border: var(--color-border);
--card-shadow: var(--shadow-default);  --card-shadow-hover: var(--shadow-md);
--card-padding: var(--space-6);  --card-padding-sm: var(--space-4);  --card-gap: var(--space-4);
--card-radius: var(--radius-lg);
```

#### Badge
```css
--badge-bg/-fg: primary;  --badge-secondary-bg/-fg;  --badge-outline-border/-fg;
--badge-destructive-bg/-fg;  --badge-padding-x: var(--space-2-5);  --badge-padding-y: var(--space-0-5);
--badge-radius: var(--radius-full);  --badge-font-size: var(--font-size-xs);
```

#### Alert / Dialog / Table
```css
/* Alert */
--alert-bg/-fg/-border (destructive variants);  --alert-padding: var(--space-4);  --alert-radius: var(--radius-lg);
/* Dialog */
--dialog-overlay-bg: rgb(0 0 0 / .5);  --dialog-bg/-fg/-border;  --dialog-shadow: var(--shadow-lg);
--dialog-padding: var(--space-6);  --dialog-radius: var(--radius-lg);  --dialog-max-width: 32rem;
/* Table */
--table-header-bg: var(--color-muted);  --table-header-fg: var(--color-muted-foreground);
--table-row-bg/-hover-bg/-fg;  --table-border;  --table-cell-padding-x: var(--space-4);  --table-cell-padding-y: var(--space-3);
```

### Component structure conventions

- One icon style and size scale per product (`icon-sm/md=24pt/lg`); consistent
  stroke width per visual layer (1.5px or 2px); don't mix filled/outline at
  the same hierarchy level.
- Cards only when elevation communicates hierarchy; otherwise group with
  borders/negative space.
- Interactive states: hover, active/pressed (visual feedback, no layout
  shift), disabled (reduced opacity 0.38-0.5 + cursor + semantic attr),
  focus (visible ring 2-4px).

## Part B — Conversion-focused layout patterns

### Pattern catalog (34 total; core ones below)

| Pattern | Section order | Primary CTA | Conversion lever |
|---|---|---|---|
| Hero + Features + CTA (`hero-features-cta`) | Hero > Value prop > Key features (3-5) > CTA > Footer | Hero (sticky) + bottom | Deep CTA placement; CTA label >=4.5:1 against fill |
| Hero + Testimonials + CTA (`hero-testimonials-cta`) | Hero > Problem > Solution > Testimonials carousel > CTA | Hero + post-testimonials | Social proof before CTA; verified testimonials (photo, name, role) |
| Product Demo + Features (`product-demo-features`) | Hero > Video/mockup > Feature breakdown > Comparison > CTA | Video center + CTA right/bottom | Interactive demo only when it beats static media; captions + non-video fallback |
| Minimal Single Column (`minimal-single-column`) | Headline > Short description > Benefit bullets (3 max) > CTA | Center large CTA | Single CTA focus; big type, whitespace, no nav clutter |
| Funnel 3-Step (`funnel-3-step-conversion`) | Step 1 problem > Step 2 solution > Step 3 action > CTA progression | Mini-CTA per step, main at end | Progressive disclosure; progress indicator; one focus per step |
| Comparison Table + CTA (`comparison-table-cta`) | Hero > Problem > Comparison table > Pricing > CTA | Table right column + below | Highlight your row; factual; add free-trial row |
| Lead Magnet + Form (`lead-magnet-form`) | Benefit headline > Preview > Minimal form > Submit | Submit button | Ask only what's needed; preview value; show progress |
| Pricing Page + CTA (`pricing-page-cta`) | Pricing headline > Cards > Feature compare > FAQ > Final CTA | Each card + sticky nav | Highlight target plan; show annual savings honestly; FAQ addresses objections |
| Video-First Hero (`video-first-hero`) | Video hero > Features overlay > Benefits > CTA | Overlay + bottom | Video only if it beats static; captions; pause control; static poster under reduced motion |
| Scroll-Triggered Storytelling (`scroll-triggered-storytelling`) | Hook > Ch1 problem > Ch2 journey > Ch3 solution > Climax CTA | End of chapters + climax | Narrative understandable without scroll effects; progress indicator |
| Waitlist/Coming Soon (`waitlist-coming-soon`) | Countdown > Teaser > Email capture > Waitlist count | Email form above fold | Explain early-access; show waitlist count only if verified/dated |
| Pricing-Focused (`pricing-focused-landing`) | Value prop > 3-tier cards > Comparison > FAQ > Final CTA | Each card + sticky nav + bottom | Popular plan highlighted; transparent totals/savings |
| App Store Style (`app-store-style-landing`) | Mockup hero > Screenshots carousel > Features > Reviews > Download CTAs | App/Play buttons throughout | Real screenshots + only current verified ratings |
| Bento Grid Showcase (`bento-grid-showcase`) | Hero > Bento grid (features) > Detail cards > Tech specs > CTA | FAB or grid bottom | Scannable value props; card bg #F5F5F7/glass; hover scale 1.02; mobile stacks |
| Trust & Authority (`trust-authority-conversion`) | Mission > Proof (logos/certs/stats) > Solution > CTA | Contact Sales / Get Quote | Security badges, case studies, low-friction form |
| Enterprise Gateway (`enterprise-gateway`) | Mission video > Solutions by industry/role > Client logos > Contact Sales | Contact Sales + Login | Path selection ("I am a..."), mega menu, trust signals |
| Portfolio Grid (`portfolio-grid`) | Name/role hero > Masonry grid > About > Contact | Card hover + footer contact | Visuals first; filter by category; fast loading |

### Conversion principles that apply to every pattern

1. **One dominant intent** per page and one primary CTA per screen;
   secondary actions subordinate.
2. **Social proof precedes the ask** — testimonials, verified logos, dated
   stats.
3. **Friction-free capture** — forms ask only what the conversion needs;
   label above input; helper text; validation on blur.
4. **Real data discipline** — no fabricated scarcity (waitlist counts, live
   status, seats, ratings) unless current, verified, and timestamped.
5. **Show, don't tell** — use an interactive demo, real screenshot, or video
   where it communicates value better than copy.
6. **Accessible motion** — every carousel has prev/next + pause controls,
   full keyboard access, stops on focus/hover/offscreen/reduced motion, and
   renders a static final state under reduced motion. Drag interactions get
   single-pointer and keyboard alternatives.
7. **CTAs pass contrast** — button label >=4.5:1 against fill, borders and
   component boundaries independently visible.

### Delivery checklist (core)

- [ ] Chose a conversion pattern from this catalog and matched CTA placement.
- [ ] One primary CTA per screen; no duplicate CTA intent.
- [ ] Semantic tokens used everywhere (no raw hex in components).
- [ ] Touch targets >=44x44pt / 48x48dp; 8px+ gaps.
- [ ] Contrast >=4.5:1 text, >=3:1 UI; not color-only meaning.
- [ ] Visible focus rings; keyboard nav; focus never obscured.
- [ ] Reduced-motion + dynamic type supported; media paused offscreen.
- [ ] Mobile-first; no horizontal scroll; min-h-dvh; 375/768/1024/1440 tested
  plus landscape.
- [ ] Micro-interactions interruptible, transform/opacity only, exit faster
  than enter.