# SkillUI — Extraction Modes Reference

CLI commands, default vs. ultra extraction, and the output token
structure of the skillui reverse-engineering tool (amaancoderx/skillui,
MIT). Run via `npx skillui` or a global `skillui` install; requires
Node.js 18+. Ultra mode additionally requires Playwright:

```bash
npm install playwright
npx playwright install chromium
```

## CLI commands

skillui takes exactly one extraction target per run, chosen by the flag
that names the input source.

| Command | Target | Behavior |
|---|---|---|
| `skillui --url <url>` | Live website | Fetches HTML, crawls all linked CSS files, extracts computed styles via Playwright DOM inspection |
| `skillui --dir <path>` | Local project directory | Scans `.css`, `.scss`, `.ts`, `.tsx`, `.js`, `.jsx` files for design tokens, Tailwind config, CSS variables, and component patterns |
| `skillui --repo <url>` | Git repository | Clones the repo to a temp directory, then runs the same scan as `--dir` |

### Supported flags

| Flag | Effect |
|---|---|
| `--mode ultra` | Enable cinematic extraction (requires Playwright) |
| `--screens <n>` | Pages to crawl in ultra mode (default: 5, max: 20) |
| `--out <path>` | Output directory (default: current directory `./`) |
| `--name <string>` | Override the project name for the output folder |
| `--format design-md\|skill\|both` | Output format (default: `both`) |
| `--no-skill` | Output DESIGN.md only; skip the `.skill` ZIP packaging |

### Examples

```bash
# Default static extraction of a live site
skillui --url https://linear.app

# Full cinematic extraction with more pages crawled
skillui --url https://nothing.tech --mode ultra --screens 10

# Scan a local Next.js app under a custom name
skillui --dir ./my-nextjs-app --name "MyApp"

# Clone and analyze a public repo
skillui --repo https://github.com/vercel/next.js --name "Next.js"

# Output only DESIGN.md, no skill packaging
skillui --url https://stripe.com --format design-md

# Save the package to a specific directory
skillui --url https://linear.app --out ./design-systems
```

## Default vs. ultra extraction

**Default mode — static analysis.** Crawls the target and extracts CSS
files, computed styles, CSS variables, and component patterns. Fast,
offline-clean, no headless browser required. Best for design tokens,
typography, spacing, components, and structure.

**Ultra mode — cinematic extraction.** Runs Playwright over the page and
adds everything that needs a real browser:

- 7 scroll-journey screenshots (`screens/scroll/scroll-000.png` through
  `scroll-100.png`) capturing the page at each scroll depth — hero /
  above the fold, ~17%, ~33%, ~50%, ~67%, ~83%, and footer;
- full-page screenshots (`screens/pages/`) and section clip shots
  (`screens/sections/`);
- hover/focus interaction-state diffs with before/after style
  snapshots;
- complete `@keyframes` extraction from `document.styleSheets`;
- animation library detection from `window.*` globals (GSAP, Lottie,
  Three.js, AOS, etc.);
- video background first-frame capture;
- DOM component fingerprinting;
- flex/grid layout extraction.

Use default mode when you need the token set and structure fast. Use
ultra mode when motion, interaction states, or faithful visual feel of
the page matter — reproduce what the page actually does, not just its
colors.

## Output structure

```
<project-name>/
├── <project-name>.skill       # Packaged .skill ZIP (contains everything)
├── SKILL.md                   # Master skill file (loaded by the coding agent)
├── CLAUDE.md                  # Claude Code project instructions
├── DESIGN.md                  # Full design system tokens
├── references/
│   ├── ANIMATIONS.md          # Motion specs and keyframes
│   ├── LAYOUT.md              # Layout containers and grid
│   ├── COMPONENTS.md          # DOM component patterns
│   ├── INTERACTIONS.md        # Hover/focus state diffs
│   └── VISUAL_GUIDE.md        # All screenshots embedded in sequence
├── screens/
│   ├── scroll/                # Scroll journey screenshots
│   │   ├── scroll-000.png     # Hero / above the fold
│   │   ├── scroll-017.png
│   │   ├── scroll-033.png
│   │   ├── scroll-050.png
│   │   ├── scroll-067.png
│   │   ├── scroll-083.png
│   │   └── scroll-100.png     # Footer
│   ├── pages/                 # Full-page screenshots (ultra)
│   └── sections/              # Section clip screenshots (ultra)
├── tokens/
│   ├── colors.json
│   ├── spacing.json
│   └── typography.json
└── fonts/                     # Bundled Google Fonts (woff2)
```

## Token JSON structures

The `tokens/` directory holds machine-readable design primitives under
stable filenames.

### tokens/colors.json

The exact color palette of the target: hex/RGB values as used in the
source, including named/role groupings where the site's own variable
naming reveals intent (e.g. background surfaces, text, brand accents,
borders). Values are literal extractions — never converted, lightened,
or "interpreted."

### tokens/spacing.json

Spacing primitives: distances, gaps, padding and margin values, and any
scaling system the target's CSS or Tailwind config exposes (rem/px
rhythm, named step scales).

### tokens/typography.json

Type decisions: font families (with locally bundled `fonts/` woff2 when
they are Google Fonts), sizes, weights, line heights, letter spacing,
and hierarchy roles derivable from the source.

### Apply rules

- **Tokens are normative.** Rebuild from them verbatim; do not
  re-derive a "nice" color or spacing scale.
- **Cross-check against DESIGN.md** before use — the markdown holds the
  composed rules the JSON primitives feed into.
- **Screenshots are evidence, not decoration.** VISUAL_GUIDE.md,
  scroll journeys, and section captures verify that a rebuilt layer
  matches the target's real composition.
- **Be honest about what the scan cannot know.** Static extraction
  yields shipped tokens, DOM structure, and computed styles — not
  design intent, brand rationale, or source-of-truth files the target
  withheld.