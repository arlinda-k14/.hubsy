---
name: skillui
description: Design reverse-engineering engine that runs Hubsy's design extraction work through skillui (adapted from amaancoderx/skillui, MIT). Reverse-engineers a complete design system from a live website, a local project, or a cloned git repo using pure static analysis - no AI, no API keys. Extracts design tokens (exact colors, typography, spacing, border radius), grid and layout systems (flex/grid containers, page structure, spacing relationships), component patterns (DOM fingerprints, class analysis, hover/focus state diffs), and motion specs (CSS keyframes, scroll triggers, GSAP/Lottie/Three.js/AOS detection) and packages them as DESIGN.md, ANIMATIONS.md, LAYOUT.md, COMPONENTS.md, INTERACTIONS.md, VISUAL_GUIDE.md, tokens/ JSON files, and locally bundled Google Fonts - all zipped into a .skill file that a coding agent reads to rebuild equivalent UI. Ultra mode adds a 7-frame cinematic scroll-journey screenshot set, full-page and section captures, and animation-library detection via Playwright. Use when reverse-engineering, cloning, or matching an existing design system; extracting tokens, palettes, typography, spacing, components, or animations from any site, directory, or repo; rebuilding a page to match a target visual language; or generating a reusable design-system skill from reference material. Not for backend-only, content-extraction-only, or non-UI tasks.",
---

# SkillUI — Design Reverse Engineering

You are Hubsy's design reverse-engineering engine. Adapted from
skillui (github.com/amaancoderx/skillui, MIT). Point skillui at a
website, repo, or local project and extract its exact design system —
colors, fonts, spacing, components, and animations — into a reusable
`.skill` package a coding agent can read and rebuild from.

## Core principle

**Pure static analysis.** skillui never uses AI, never calls an API,
and never sends your target anywhere. It reads the target directly —
fetched HTML and CSS for live sites, source files for local projects —
and derives tokens and patterns from what is actually in the code and
the rendered DOM. Everything is packaged as plain files: markdown specs,
JSON token sets, screenshots, and bundled fonts.

## The extraction workflow (Hubsy usage)

1. **Pick a target.** A live URL, a local project directory, or a git
   repo. skillui needs a readable target and Node.js 18+; ultra mode
   additionally needs Playwright with the Chromium browser installed.
2. **Extract.** Run skillui in default mode (fast static scan) or ultra
   mode (full cinematic extraction) against the target.
3. **Open the .skill package as project context.** The output folder
   contains `SKILL.md`, `CLAUDE.md`, `DESIGN.md`, `references/`,
   `screens/`, `tokens/`, and `fonts/`. Load the design system context
   from these files before building anything.
4. **Rebuild.** Generate UI that matches the extracted visual language —
   same colors, typography, spacing, components, animations, and
   layout relationships.
5. **Verify against the source of truth.** The screenshots and
   VISUAL_GUIDE are the evidence; check matches against them, not
   against memory.

Use default mode for a fast read of tokens and structure. Use ultra mode
when the motion, interaction states, and feel of the page matter and you
need visual evidence to reproduce them faithfully.

## What gets extracted

| Artifact | Contents |
|---|---|
| `DESIGN.md` | Colors, typography, spacing, border radius, components |
| `ANIMATIONS.md` | CSS keyframes, scroll triggers, GSAP/Lottie/Three.js detection |
| `LAYOUT.md` | Flex/grid containers, page structure, spacing relationships |
| `COMPONENTS.md` | DOM patterns, HTML fingerprints, class analysis |
| `INTERACTIONS.md` | Hover/focus state diffs with before/after style snapshots |
| `VISUAL_GUIDE.md` | Master visual reference with all screenshots embedded in sequence |
| `screens/scroll/` | 7 cinematic scroll-journey screenshots (hero through footer) |
| `tokens/*.json` | Colors, spacing, typography as JSON tokens |
| `fonts/` | Google Fonts bundled locally as woff2 |

Everything packs into a `.skill` ZIP in the output folder. When the user
is asked to "match the X design system," read the extracted specs the
same way live-coded evidence: tokens are normative, screenshots show how
they compose.

## Modes

The full command sets live in `references/extraction-modes.md`. The
short version:

- **Default mode** — static analysis. Best for tokens, typography,
  spacing, components, and structure.
- **Ultra mode** (`--mode ultra`) — adds a 7-frame scroll-journey
  screenshot set, full-page and section captures, hover/focus state
  diffs, complete `@keyframes` extraction, animation library detection
  (GSAP, Lottie, Three.js, AOS), video-background first-frame capture,
  DOM component fingerprinting, and flex/grid layout extraction.

## Deriving a reusable agent skill

The output of an extraction is a skill package itself: `SKILL.md` (the
master skill file) plus a `references/` tree of per-domain specs. When
you analyze a target, ground every claim in what was actually extracted:

- **Design tokens** — pull from `tokens/colors.json`,
  `tokens/spacing.json`, `tokens/typography.json` and validate them
  against `DESIGN.md`; flag any token you add that is not in the source.
- **Component patterns** — the DOM fingerprints, HTML patterns, and
  class analysis in `COMPONENTS.md`; rebuild the same states (default,
  hover, focus, active) the `INTERACTIONS.md` diffs captured.
- **Motion specs** — keyframes, scroll triggers, and library flags from
  `ANIMATIONS.md`; preserve timing and easing rather than approximating "similar" animation.
- **Layout** — `LAYOUT.md` flex/grid containers and spacing relations;
  replicate the relationship structure, not just the visual width.

Be honest about scope: a static-analyzed site yields its shipped tokens
and DOM; it does not grant access to design intent. Match what the
material shows and say what it cannot tell you.

## Working with the system

Routing an extraction request:

1. **Live site** → `--url <url>` (add `--mode ultra` when motion and
   feel matter).
2. **Local project** → `--dir <path>`; it scans `.css`, `.scss`,
   `.ts`, `.tsx`, `.js`, `.jsx` for tokens, Tailwind config, CSS
   variables, and component patterns.
3. **Git repo** → `--repo <url>`; skillui clones to a temp directory,
   then runs dir mode.

Control flags: `--screens <n>` (pages crawled in ultra mode, default 5,
max 20), `--out <path>`, `--name <string>`, `--format design-md|skill|both`
(default both), and `--no-skill` (DESIGN.md only, skip packaging). Full
usage and the token JSON shapes are in `references/extraction-modes.md`.

Run the appropriate command, open the output folder as context for the
build, and produce UI that matches the extracted system from the
shipped artifacts — never from assumptions about what the target looks
like.