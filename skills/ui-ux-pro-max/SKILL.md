---
name: ui-ux-pro-max
description: Advanced UI/UX design intelligence for web, mobile, and desktop interfaces, derived from ui-ux-pro-max-skill (github.com/nextlevelbuilder/ui-ux-pro-max-skill). Defines the professional-grade design rules: user conversion flows (funnel, hero+features+CTA, pricing, lead-magnet, waitlist, social-proof patterning), micro-interaction guidelines (press feedback within 100ms, spring physics, staggered reveals, exit-faster-than-enter, interruptible and cancel-safe animations), component design tokens (semantic color/space/radius/font tokens with component-level button/input/card/badge/alert/dialog/table token maps), responsive grid layouts (mobile-first, 375/768/1024/1440 breakpoints, 4/8dp spacing rhythm, min-h-dvh, no horizontal scroll, 60-75ch line length), and WCAG accessibility standards (4.5:1 contrast, visible focus 2-4px, 44x44pt touch targets, keyboard nav, focus-not-obscured, reduced-motion, label-above-input). Use when designing, building, reviewing, or fixing interfaces, pages, components, design systems, or conversion-focused landing pages that must meet professional UX/accessibility bar.
---

# UI/UX Pro Max — Advanced Design Intelligence

You are Hubsy's advanced UI/UX engine, adapted from ui-ux-pro-max-skill
(https://github.com/nextlevelbuilder/ui-ux-pro-max-skill). Applies when the
task involves **UI structure, visual design decisions, interaction patterns,
or UX quality control**: designing new pages, refactoring components,
choosing color/typography/spacing/layout systems, reviewing for UX and
accessibility, or improving perceived quality and usability.

Full component and conversion-pattern catalogs live in
`references/ux-framework.md`. Load it before a design or review pass.

## Rule categories by priority

Apply focus in this order: Accessibility before Interaction before
Performance before Style before Layout. The binding constraints are marked
CRITICAL.

| # | Category | Priority | Core requirement |
|---|---|---|---|
| 1 | Accessibility | CRITICAL | Contrast 4.5:1, alt text, keyboard nav, aria-labels, focus rings |
| 2 | Touch & Interaction | CRITICAL | Targets >=44x44pt, 8px+ spacing, press/loading feedback |
| 3 | Performance | HIGH | WebP/AVIF, lazy loading, reserve space (CLS < 0.1) |
| 4 | Style Selection | HIGH | Match product type; SVG icons, no emoji; consistency |
| 5 | Layout & Responsive | HIGH | Mobile-first breakpoints, no horizontal scroll, min-h-dvh |
| 6 | Typography & Color | MEDIUM | Base 16px, line-height 1.5, semantic color tokens |
| 7 | Animation | MEDIUM | Meaningful motion, context-aware timing, reduced-motion safe |
| 8 | Forms & Feedback | MEDIUM | Visible labels, inline errors, progressive disclosure |
| 9 | Navigation | HIGH | Predictable back, bottom nav <=5, deep linking |
| 10 | Charts & Data | LOW | Legends, tooltips, not color-only meaning |

## 1. User conversion flows

Design pages as conversion machines with an explicit section order and one
dominant action. Common conversion frameworks (see reference for all 34):

| Pattern | Section order | Primary CTA placement |
|---|---|---|
| Hero + Features + CTA | Hero > Value prop > Key features (3-5) > CTA > Footer | Hero (sticky) + bottom |
| Hero + Testimonials + CTA | Hero > Problem > Solution > Testimonials carousel > CTA | Hero + post-testimonials |
| Funnel (3-step) | Step 1 problem > Step 2 solution > Step 3 action | Mini-CTA per step, main at end |
| Pricing Page | Pricing cards > Feature comparison > FAQ > Final CTA | Each card + sticky nav + bottom |
| Lead Magnet + Form | Benefit headline > Preview > Minimal form > Submit | Submit button |
| Waitlist / Coming Soon | Countdown > Teaser > Email capture > Waitlist count | Email form above fold |

Conversion rules that always apply:
- **One primary CTA per screen**; secondary actions visually subordinate.
- **Social proof before CTA** — testimonials, verified logos, real stats.
- **Progressive disclosure** — reveal a funnel one step at a time with a
  progress indicator; never overwhelm upfront.
- **Show, don't tell** — an interactive demo or real screenshot beats copy.
- **Friction-free forms** — ask only for what the conversion actually needs.
- **Don't fabricate scarcity** — waitlist counts, live status, and seat
  availability must be real, current, verified, and dated.

## 2. Micro-interaction guidelines

Every motion must communicate hierarchy, feedback, or state — never be
decoration.

- **Press feedback within 80-150ms** (target 100ms): ripple / opacity /
  elevation for taps; subtle `scale` 0.95-1.05 on tappable cards; restore on
  release. Do not shift layout bounds.
- **Timing tokens, not one magic number**: pick duration by distance,
  complexity, platform, and context. Exit faster than enter (~60-70% of
  enter) to feel responsive.
- **Easing**: deceleration on arrival, acceleration when leaving; linear
  only for truly constant-rate progress. Prefer spring/physics curves over
  linear/cubic-bezier for a natural feel.
- **Stagger reveals** 30-50ms per item; never all-at-once or glacial.
- **Animate only `transform` and `opacity`**; never width/height/top/left.
- **Interruptible and cancel-safe**: a tap/gesture cancels in-progress
  animation; UI stays interactive; rarely block input. Rapid state changes
  cancel/park prior micro-interactions, set the final state explicitly, and
  never depend on an animation-end event.
- **Continuity**: page/screen transitions keep spatial continuity (shared
  element, directional slide). Modal/sheets animate from their trigger
  source (scale+fade or slide-in). Forward nav animates left/up, back
  right/down.
- **Limit motion**: animate 1-2 key elements per view; fade fully or keep
  visible (never linger below opacity 0.2).
- **Reduced motion is non-negotiable**: honor `prefers-reduced-motion`;
  disable parallax, scroll-scrub, marquees, and pulsing; render the static
  final state instead. Pause offscreen/hidden media and carousels.
- **Forbidden**: `window.addEventListener('scroll')` jank, layout reflow from
  animation during animation, blocking pointer events mid-animation.

## 3. Component design tokens

Build every component from a **semantic token layer**, never raw hex.

### Primitive -> semantic -> component

- **Primitives:** color scale, space scale (4/8dp rhythm), radius scale,
  font-size/weight scale, shadow/elevation scale.
- **Semantic:** `--color-primary`, `--color-foreground`, `--color-background`,
  `--color-muted`, `--color-error`, `--color-ring`, `--space-4`, `--radius-md`,
  `--font-size-sm`, `--shadow-default`.
- **Component:** each component maps semantic tokens to its own vars, e.g.
  `--button-bg: var(--color-primary)`.

### Canonical component token map (abridged — full CSS in reference)

| Component | Key tokens |
|---|---|
| Button | `--button-bg/fg/hover-bg/active-bg`; variants secondary/outline/ghost/destructive; `--button-radius: var(--radius-md)`, padding `--space-4/2`, font `sm`/`medium` |
| Input | `--input-bg/border/fg`, placeholder, focus (ring), error, disabled; `--input-radius: var(--radius-md)` |
| Card | `--card-bg/fg/border`, `--card-shadow/-hover`, padding `--space-6`, radius `--radius-lg` |
| Badge | `--badge-bg/fg`, outline/destructive variants, padding `--space-2-5/0-5`, radius `full` |
| Alert | `--alert-bg/fg/border`, destructive variant, padding `--space-4`, radius `--radius-lg` |
| Dialog | `--dialog-overlay-bg` (rgb 0 0 0 / .5), `--dialog-bg/fg/border/shadow`, padding `6`, radius `lg`, max-width 32rem |
| Table | `--table-header-bg/fg`, `--table-row-bg/hover/fg`, `--table-border`, cell padding `4 / 3` |

**Token discipline:** dark mode uses desaturated/lighter tonal variants
(inverted colors are not dark mode); semantic color tokens mapped per theme
across surfaces/text/icons; no per-screen hardcoded hex; one icon style
(stroke width, radius) and one size scale per product; tabular/monospaced
figures for data columns, prices, and timers to prevent layout shift.

## 4. Responsive grid layouts

- **Mobile-first:** design for small screens first, then scale up.
- **Breakpoints:** systematic `375 / 768 / 1024 / 1440`; never arbitrary px.
- **Viewport:** `width=device-width, initial-scale=1`, never disable zoom;
  use `min-h-dvh` not `100vh`.
- **No horizontal scroll** on mobile; content must fit viewport width.
- **Container width:** consistent max-width on desktop (`max-w-6xl/7xl`).
- **Spacing rhythm:** 4/8dp incremental scale (`--space-*` 1,1.5,2,2.5,3,4,
  6,8...) with section tiers (16/24/32/48).
- **Readability:** mobile 35-60 chars/line, desktop 60-75; body min 16px
  (avoids iOS auto-zoom); line-height 1.5-1.75.
- **Z-index scale:** layered (0/10/20/40/100/1000), never arbitrary.
- **Fixed bars:** reserve padding so sticky nav/bottom bar never covers
  content; safe-area-aware on native (notch, status bar, gesture area).
- **Orientation:** layout stays readable/operable in landscape.

## 5. WCAG accessibility standards

- **Contrast:** normal text >=4.5:1 (WCAG AA), large text >=3:1, 7:1 for AAA;
  data lines/bars >=3:1. Non-text UI and control boundaries >=3:1. CTA label
  verifiable against its fill.
- **Focus:** visible focus rings 2-4px on all interactive elements; focus
  must not be obscured by sticky UI/overlays (WCAG 2.2); verify indicator
  area + 3:1 state contrast. Tab order matches visual order.
- **Keyboard:** full keyboard support; skip-to-content; sequential `h1-h6` no
  skips; drag-and-drop needs a single-pointer and keyboard alternative;
  web pointer targets >=24x24 CSS px (WCAG 2.2 AA).
- **Touch:** min 44x44pt (iOS) / 48x48dp (Android); 8px+ gap between targets;
  do not rely on hover alone; icon-only buttons need `aria-label` /
  accessibilityLabel; icons >=3:1 against adjacent colors.
- **Forms:** visible labels (never placeholder-only); errors near the field,
  linked with `aria-describedby`, inline retained; focus error summary after
  failed submit with multiple errors; semantic input types; allow password
  managers and paste.
- **Reduced motion / dynamic type:** support system text scaling without
  truncation; pause/stop carousels and auto-rotation, stop on focus or
  reduced motion; summaries announced via `aria-live`/`role=alert` without
  stealing focus.
- **Color:** never convey meaning by color alone — always add icon/text;
  red/green-only chart pairs need patterns/textures/table alternative.
- **Headers/landmark:** heading hierarchy sequential; skip links; move focus
  to main content on route change.

## Workflow

1. **Analyze** the request: product type, audience, style keywords, stack
   (detect from `package.json` / `pubspec.yaml` / platform markers — never
   assume).
2. **Pick a conversion pattern** from `references/ux-framework.md` that fits
   the page's goal and audience.
3. **Establish the design system**: map primitives to semantic tokens, select
   typography/color/radius/spacing scales, set light/dark variants together.
4. **Apply micro-interaction and motion rules** with the emphasis on
   meaning, interruptibility, and reduced-motion safety.
5. **Review against this priority table** before delivery — CRITICAL items
   first, then the reference's checklists.