# Design System

The token contract, the contrast floor, and the rules that keep the result
looking chosen rather than generated.

## Token contract

Declare these in `:root`. The audit script looks for them by name, and
`contrast.py --tokens` resolves the `--fg-on-*` pairs, so the names are load
bearing — do not rename them for variety.

```css
:root {
  /* colour */
  --ink:            #1c1c1a;
  --ink-muted:      #4a4740;
  --surface:        #f4f1ea;
  --surface-raised: #fbf9f5;
  --accent:         #7d5f26;
  --accent-deep:    #5c471c;
  --border:         #d8d2c6;

  /* audit pairs — the checker resolves var() chains through these */
  --fg-on-surface:  var(--ink);
  --fg-on-ink:      var(--surface);
  --fg-on-accent:   var(--surface);
  --fg-on-accent-deep: var(--surface);
  --fg-on-surface-raised: var(--ink);

  /* type */
  --font-display: "Hoefler Text", "Iowan Old Style", "Apple Garamond", Garamond,
                  "Palatino Linotype", Palatino, "Times New Roman", serif;
  --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue",
               Arial, sans-serif;
  --type-display: clamp(2.75rem, 1.5rem + 5.5vw, 5.5rem);
  --type-h2:      clamp(2rem, 1.4rem + 2.6vw, 3.25rem);
  --type-h3:      clamp(1.5rem, 1.25rem + 1.1vw, 2rem);
  --type-body:    clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem);
  --type-lead:    clamp(1.25rem, 1.1rem + 0.7vw, 1.5rem);
  --type-eyebrow: 0.75rem;
  --leading-tight: 1.08;
  --leading-snug:  1.25;
  --leading-body:  1.7;
  --tracking-eyebrow: 0.18em;
  --measure: 38em;

  /* space — a single scale, used everywhere */
  --space-3xs: 0.25rem;  --space-2xs: 0.5rem;   --space-xs: 0.75rem;
  --space-sm:  1rem;      --space-md:  1.5rem;   --space-lg:  2.5rem;
  --space-xl:  4rem;      --space-2xl: 6rem;     --space-3xl: 9rem;
  --section-pad: clamp(4.5rem, 3rem + 7vw, 10rem);
  --gutter: clamp(1.25rem, 4vw, 3rem);
  --container: 76rem;

  /* motion */
  --ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  --dur: 700ms;
  --reveal-distance: 1.5rem;
}
```

## The contrast floor

Default is WCAG 2.2 AA: **4.5:1** for body text, **3:1** for large text (24px,
or 18.66px bold) and for focus indicators and meaningful non-text UI. AAA is
7:1 and constrains a luxury palette hard — only take it if the user asks.

Verify before writing layout, not after:

```bash
python3 scripts/contrast.py --tokens styles.css
```

Two failure modes account for nearly every luxury palette that breaks:

**Metallic accent on a light ground.** Gold on warm ivory is the single most
common one, because gold looks correct in a brand deck and sits at 3.09:1 on
the page:

```
#a8843c on #f4f1ea  ->  3.09:1   FAIL (needs 4.50:1)
```

The fix is lightness, not hue. Darken along the same hue until it clears:

```
#7d5f26 on #f4f1ea  ->  5.26:1   PASS
#6f5420 on #f4f1ea  ->  6.28:1   PASS
```

**Muted body text on a tinted ground.** A grey chosen on white lands at 4.54:1
and at 4.0:1 the moment the ground warms. Test against the actual `--surface`,
never against white.

**Metallic accents are not text colours.** Reserve them for hairlines, rules,
small-caps eyebrows at large sizes, and focus rings. Body and headings take
`--ink`. This is a rule about hierarchy as much as contrast — a gold paragraph
reads as a hotel, not a house.

When a pair fails, report the failing pair, propose corrected hex values, and
let the user choose. Never silently adjust a brand colour.

## Typography

System stacks by default: no network request, no layout shift, and Lighthouse
stays out of trouble. If the user supplies a specific typeface, import at most
one, with `preconnect` and `display=swap`, and keep the system stack as the
`font-family` fallback so a failed import is invisible.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap">
```

Cormorant Garamond is the better luxury serif than Playfair Display, which is
now the house style of every template shop.

- Headings: the serif. Weight 300 or 400, never 700. Tight leading, optical
  sizing, and a slight negative tracking at display sizes.
- Body: the sans, 1.7 leading, capped at `--measure` (about 38em). Long
  measures are the fastest way to make a premium page feel cheap.
- Eyebrows: 0.75rem, uppercase, `0.18em` tracking, `--ink-muted`. This is the
  one place a restrained accent is allowed, and only at these sizes.
- Never italicise a serif for an intro line. Set it in roman.

## Layout

- Container `76rem`, centred, with a fluid `--gutter`. Full-bleed images may
  escape the container; text never does.
- Sections separated by `--section-pad` and a hairline, not by boxes.
- Asymmetry beats symmetry: 7/5 and 5/7 column splits, an offset image, a
  caption that hangs into the margin. A perfectly centred single column is
  fine for one section in six, not for the page.
- The three test widths are 375, 768, and 1440. 375 must not rely on hover,
  and 1440 must not leave a line of text running the full width of the screen.

## Depth

Surfaces separate by background value, not by shadow. `--surface-raised` on
`--surface` with a 1px `--border` at 60% opacity reads as a card without
shadows. If you do use a shadow, it is a single tight one — `0 1px 2px
rgba(0,0,0,.06)` — and never a wide diffuse glow.

## Motion

Fade or reveal on scroll, nothing else.

```css
@media (prefers-reduced-motion: no-preference) {
  .reveal {
    opacity: 0;
    transform: translateY(var(--reveal-distance));
    transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
  }
  .reveal.is-visible { opacity: 1; transform: none; }
}
```

The `no-preference` wrapper is the whole accessibility story: inside it the
elements are fully visible by default, so with JavaScript disabled or
`prefers-reduced-motion` set, nothing is ever stuck at `opacity: 0`. That
ordering is not optional. No parallax, no counters, no marquee, no
auto-advancing carousel, no entrance animation longer than 800ms.

## Forbidden

| Pattern | Why it is banned |
|---|---|
| `linear-gradient` / `radial-gradient` as decoration | The stock tell. A flat ground reads as more expensive. |
| `backdrop-filter`, glassmorphism | Dated by 2019. |
| Coloured `text-shadow`, glows | Cheap. Breaks at small sizes. |
| Geometric line icons, generic outline icon sets | Reads as a template, not a house. Use type and rules instead. |
| Full-bleed hero with centred text | The most recognisable AI-generated layout there is. Offset it, or crop into it. |
| Floating rounded cards in a 3-up grid | The default SaaS page. Use rules and whitespace. |
| Stiff symmetrical 3-up / 4-up grids | No personality. Break the rhythm. |
| Sticky animated counters, stat rows with big numbers | Startup deck, not atelier. |
| A "trusted by" logo strip | Nobody believes a logo strip and it dates the page. |
