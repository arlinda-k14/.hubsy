# Impeccable Design — Command Reference

Summarized from the pbakaus/impeccable skill (Apache 2.0). Commands are
invoked as `impeccable <verb> [target]`. A target names a source file or
route. Most commands load your active project context (PRODUCT.md,
DESIGN.md, the matching surface brief) first.

## Core commands

### init — capture durable product context

Writes `PROJECT_ROOT/PRODUCT.md` with confirmed product truth only. It
never invents a visual world and never writes DESIGN.md.

1. **Load state** — update an existing PRODUCT.md; do not create a
   competing authority. Only DESIGN.md exists? Leave it, add PRODUCT.md.
2. **Explore** — scan product docs, copy, package/config boundaries,
   features, routes, roles, brand and legal assets, platform signals.
   Repo evidence is a hypothesis, not approval.
3. **Interview** — ask only about material gaps you cannot infer. Ask
   what most changes future decisions: primary user + job, what the
   product makes possible and how it is meaningfully different, and
   durable constraints/assets to preserve. Do not ask about aesthetics,
   palettes, or typography during init.
4. **Write** — platform is the bare value `web` / `ios` / `android` /
   `adaptive`. Sections: Users, Product Purpose, Positioning, Operating
   Context, Capabilities and Constraints, Brand Commitments, Evidence on
   Hand, Product Principles, Accessibility & Inclusion. Omit irrelevant
   sections; write only confirmed facts.
5. **Record workflow defaults** — ask once for comp-first vs code-first
   when image generation is available; store in `.impeccable/config.json`.

Pillars of the record: users, jobs, workflows, purpose, success,
positioning, operating context, capabilities, constraints, evidence,
platform, accessibility, confirmed brand voice/assets, and 3-5 durable
product principles.

### document — generate DESIGN.md from existing code

Writes the current visual system to `PROJECT_ROOT/DESIGN.md` so future
screens stay on-brand. Follows the DESIGN.md spec: YAML frontmatter of
machine-readable tokens, then up to eight markdown sections in fixed
order — Overview, Colors, Typography, Layout, Elevation & Depth, Shapes,
Components, Do's and Don'ts. Tokens are normative; prose is context.

- **Scan mode** (default): grep CSS custom properties (`--color-`,
  `--font-`, `--spacing-`, `--radius-`, `--shadow-`), read Tailwind
  theme config, CSS-in-JS theme files, token files (Style Dictionary /
  W3C), then component variants. Extract tokens, then confirm language.
- **Seed mode** (`document --seed`): pre-implementation projects; reuse
  the visual-world workshop and write a directional seed.
- Token refs use `{colors.primary}` style paths. Component sub-tokens
  are capped at eight props (backgroundColor, textColor, typography,
  rounded, padding, size, height, width). Never overwrite an existing
  DESIGN.md silently — offer refresh, overwrite, or merge.

Run when: a coherent incumbent system has no DESIGN.md, first
implementation of a new world needs carbonizing, DESIGN.md is stale, or
before a redesign to capture current state.

### critique — UX design review with heuristic scoring

Evaluates the **user experience**: visual hierarchy, information
architecture, cognitive load, accessibility, responsive behavior,
counterfeit design tokens, and anti-patterns. Produces sniff tests +
heuristic screening, a Design Health Score per dimension, a Design
Specificity Verdict (does this look like an interchangeable product?),
persona red flags, priority issues, and an Overall Impression.

- **Hard invariants** before critique: read the brief; respect pinned
  aesthetics; never report new-work as if it violated your taste;
  separate product-specific visual judgment from generic heuristics.
- **Heuristics**: Nielsen's ten — visibility of system status; match
  with the real world; user control and freedom; consistency and
  standards; error prevention; recognition rather than recall;
  flexibility and efficiency; aesthetic and minimalist design; help
  users recognize/recover from errors; help and documentation.
- **Cognitive load**: watch for wall-of-options (overchoice), the
  memory bridge (requirements users must hold in mind), hidden
  navigation, jargon barriers, visual-noise floors, inconsistent
  patterns, multi-task demands, and context switches.
- **Personas**: run the design through representative users — Impatient
  Power User, Confused First-Timer, Accessibility-Dependent User,
  Deliberate Stress Tester, Distracted Mobile User.
- Score each dimension 0-4; tag issues P0 blocking, P1 major (WCAG AA
  violations are P1 minimum), P2 minor, P3 polish. Persist a snapshot
  when instructions ask, so a later polish pass can close the backlog it
  opened.

### audit — technical quality checks

A code-level audit, distinct from critique. Five dimensions, scored 0-4
each (total /20), with P0-P3 severity and an executive summary:

1. **Accessibility** — contrast < 4.5:1 (7:1 AAA), missing ARIA labels
   or states, keyboard focus/tab order/traps, heading hierarchy and
   landmarks, missing alt text, unlabeled form inputs, motion-sensitivity
   handling that respects `prefers-reduced-motion`.
2. **Performance** — layout thrashing, expensive animations, unbounded
   blur/filter/shadow, missing lazy loading, `will-change` abuse, bundle
   bloat, unneeded re-renders.
3. **Theming** — hard-coded colors outside tokens, broken dark mode,
   inconsistent token use, values that fail to update on theme switch.
4. **Responsive** — fixed widths, touch targets under 44x44px, broken
   touch gestures (mouse-only handlers, missing `touch-action`, drag
   state never cleared), horizontal scroll, text-scaling breakage,
   missing breakpoints.
5. **Implementation integrity (critical)** — run the visual detector,
   verify each finding in context, look for design-system drift and
   structure interchangeable with an unrelated product.

Rating bands: 18-20 Excellent, 14-17 Good, 10-13 Acceptable,
6-9 Poor, 0-5 Critical. Audit documents problems for other commands to
fix; it does not fix them itself. Always verify findings — never report
false positives, always report what's working, always map each finding
to a fix command.

### polish — final quality pass before shipping

Refinement, **never concealed redesign**: preserve the incumbent visual
world, content, and behavior; if the concept is wrong, say so and
recommend redesign instead of smuggling in a replacement.

1. **Establish the system** — read DESIGN.md, tokens, shared components,
   neighboring flows. Classify every drift: missing token, one-off
   implementation, conceptual mismatch, or local defect; fix at the
   narrowest correct level. If a prior critique snapshot exists, read and
   honor its P0/P1 findings.
2. **Gather evidence** — use the feature yourself at representative
   sizes (desktop + mobile; shipped device classes on native). Confirm
   the quality bar, constraints, and real states users will hit.
3. **Triage** — functional defects first (broken/blocked tasks, data
   loss, misleading state, inaccessible paths), then missing loading/
   empty/error/success/disabled/permission states, then flow, hierarchy,
   responsive and design-system drift, then visual and motion
   inconsistencies, then code and asset cleanup.
4. **Polish the whole path** — not one corner. Match neighbors' mental
   models; make the primary task obvious without flattening hierarchy;
   align to the grid and spacing scale (fix optical too); keep same-role
   typography consistent; use semantic tokens with stable color meanings;
   check contrast in every state; coherent icon families; every control
   gets hover/focus/active/disabled/loading/error states; motion is
   coherent, interruptible, performant; keep copy factual — ask before
   changing claims; remove debug output, dead code, unused imports.
5. **Verify and finish** — walk the full path again with mouse, keyboard,
   and touch; check states, zoom, contrast, focus, semantics, console
   errors, layout shift, latency, agreement with DESIGN.md; then a source
   diff to strip accidental churn. Ship only functionally complete work.

## Supporting commands (same quality floor)

- `extract` — pull reusable tokens and components out of a codebase into
  the design system.
- `bolder` — amplify safe or bland designs; `quieter` — tone down
  aggressive or overstimulating ones; `distill` — strip to essence.
- `harden` — production-ready error, i18n, and edge-case handling.
- `onboard` — first-run flows, empty states, activation.
- `animate` — purposeful motion; `colorize` — strategic color;
  `typeset` — typographic hierarchy; `layout` — spacing/rhythm/hierarchy;
  `delight` — personality; `overdrive` — past conventional limits.
- `clarify` — UX copy, labels, error messages; `adapt` — device/size
  adaptation; `optimize` — UI performance diagnosis.
- `live` / `generate` — iterate on variants against the running page.

## Visual anti-pattern rules

The quality floor below is mandatory in crafted work. When scanning a
codebase, treat occurrences of these as defect evidence to verify, not
proof of quality on their own.

**Absolute bans (never ship):**

- **Thin borders + wide shadows** — the "AI product card": 1px border
  plus a large low-opacity `box-shadow`. Use layered surfaces, stroke,
  or a designed shadow instead.
- **Radial spotlights and glows** — `radial-gradient` halos behind
  content and `drop-shadow` blobs that read as a spotlight.
- **Pulsing/scanning decorative dots** — bouncing or pulsing status
  dots, marquee keyframes recreated from scratch.
- **Grid/graph-paper backgrounds** for decorative effect, and inset or
  pseudo-element striped patterns.
- **Oversized H1 that never resolves content hierarchy** — huge
  headings used to fill space rather than structure.
- **Hero eyebrow / kicker above the heading** — the one-word uppercase
  label ("Discover", "Welcome") crowning every hero, and numbered
  section labels ("01. Features").
- **Italic serif intro lines** — the decorative pull-quote intro in a
  serif face with no role.
- **Em-dash overuse** — more than one em dash per screen reads as AI
  house style.
- **Shape-assembled illustrations** — fake "people" built from stacked
  circles and rectangles in a comment card.
- **Emoji-only text** as a stand-in for icons or illustration.
- **Content hidden at rest** without a legit disclosure pattern, and
  motion that blocks focus or reading.

**Patterns to prefer instead:** real depth distributions, optical
alignment, token-driven color, purposeful motion that is interruptible
and cancel-safe (`prefers-reduced-motion` respected), semantic HTML,
visible keyboard focus, WCAG AA contrast, and consistency with the
committed DESIGN.md system.