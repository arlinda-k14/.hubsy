# Build Recipes

Markup and CSS patterns that satisfy the accessibility floor without a framework
and stay under the Lighthouse target.

## File layout

```
project-root/
  index.html
  services.html            (only if confirmed)
  about.html               (only if confirmed)
  contact.html             (only if confirmed)
  styles.css
  js/main.js               (only if JS was confirmed; <3KB, defer)
  assets/
    images/hero-banner.svg
    images/craft-detail.svg
    fonts/                 (only if fonts are local)
```

SVG for placeholders, not generated binaries. The `assets/images/*.jpg` in the
brief is a naming convention; SVG gives the correct aspect ratio, a rendered
label, and a few hundred bytes.

## Page skeleton

Semantic HTML5, one `<h1>`, landmarks in order, skip link first thing in the
body so it is the first tab stop.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{brand_name}} — {{short_positioning}}</title>
  <meta name="description" content="{{offering_description, <=155 chars}}">
  <meta name="theme-color" content="{{surface hex}}">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">…</header>
  <main id="main">
    <section class="hero" aria-labelledby="hero-title">…</section>
    <section aria-labelledby="value-title">…</section>
    <section aria-labelledby="proof-title">…</section>
    <section aria-labelledby="offerings-title">…</section>
    <section class="closing-cta" aria-labelledby="closing-title">…</section>
  </main>
  <footer class="site-footer">…</footer>
  <script src="js/main.js" defer></script>
</body>
</html>
```

The `<script>` is omitted entirely when `js_features` is empty. The newsletter
modal, when requested, is a `<dialog>` in the body with its own `js/main.js`
enhancement.

## Section order

Hero, value proposition, credibility, offerings, closing CTA, footer. Do not
reorder without a reason the user gave you. Every section is labelled by its
heading via `aria-labelledby`, which is what makes the heading the accessible
name of the region.

## Focus states

Never remove the outline without replacing it. A focus ring is also one of the
few places a metallic accent is unambiguously correct.

```css
:focus-visible {
  outline: 2px solid var(--accent-deep);
  outline-offset: 3px;
  border-radius: 1px;
}
:focus:not(:focus-visible) { outline: none; }
```

## The primary CTA

One per section, no exceptions. Two primary buttons in a section is a design
failure, not a conversion tactic.

```html
<a class="cta cta--primary" href="#enquiry">{{primary_cta}}</a>
```

```css
.cta--primary {
  display: inline-block;
  padding: var(--space-sm) var(--space-lg);
  background: var(--ink);
  color: var(--surface);
  border: 1px solid var(--ink);
  text-decoration: none;
  letter-spacing: 0.04em;
  transition: background-color var(--dur) var(--ease),
              color var(--dur) var(--ease);
}
.cta--primary:hover { background: var(--accent-deep); border-color: var(--accent-deep); }
```

Secondary actions are text links with a hairline underline, not a second filled
button. `--fg-on-*` tokens must be checked for every one of these pairings.

## Inquiry form

Netlify Forms detect on `data-netlify` with no server and no build step. The
hidden `form-name` input is required. Every control gets a real `<label>`;
`aria-required` and `required` together, never an asterisk alone.

```html
<form name="enquiry" method="POST" data-netlify="true" netlify-honeypot="bot-field">
  <input type="hidden" name="form-name" value="enquiry">
  <p class="hp"><label>Do not fill this out <input name="bot-field"></label></p>

  <div class="field">
    <label for="f-name">Name</label>
    <input id="f-name" name="name" type="text" autocomplete="name" required aria-required="true">
  </div>

  <div class="field">
    <label for="f-email">Email</label>
    <input id="f-email" name="email" type="email" autocomplete="email" required aria-required="true">
  </div>

  <div class="field">
    <label for="f-phone">Phone <span class="optional">(optional)</span></label>
    <input id="f-phone" name="phone" type="tel" autocomplete="tel">
  </div>

  <div class="field">
    <label for="f-interest">What are you enquiring about</label>
    <select id="f-interest" name="interest">
      <option value="">Please choose</option>
      <option value="offering-1">{{offering_1}}</option>
      <option value="offering-2">{{offering_2}}</option>
      <option value="offering-3">{{offering_3}}</option>
      <option value="other">Something else</option>
    </select>
  </div>

  <div class="field">
    <label for="f-message">How can we help</label>
    <textarea id="f-message" name="message" rows="5" required aria-required="true"></textarea>
  </div>

  <button class="cta cta--primary" type="submit">{{primary_cta}}</button>
  <p class="form-note">We reply personally, usually within two working days.</p>
</form>
```

Never `display:none` the honeypot — screen readers need it, and Netlify
ignores it otherwise. Use the visually-hidden pattern below. The form-note is
the soft answer to the time-commitment objection.

```css
.visually-hidden,
.hp {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.skip-link {
  position: absolute;
  left: var(--space-sm);
  top: -100%;
  z-index: 100;
  padding: var(--space-2xs) var(--space-sm);
  background: var(--ink);
  color: var(--surface);
}
.skip-link:focus { top: var(--space-sm); }
```

## Newsletter modal — opt-in only

Only if the user confirmed it. Native `<dialog>`, so focus trapping, `Esc`, and
the backdrop come from the platform. Under 3KB total for `js/main.js`, and the
page is fully usable with the file deleted.

```html
<dialog id="newsletter" class="modal" aria-labelledby="nl-title">
  <form method="dialog" class="modal__close-form">
    <button class="modal__close" aria-label="Close">&times;</button>
  </form>
  <h2 id="nl-title">{{newsletter_headline}}</h2>
  <p>{{newsletter_subline}}</p>
  <form name="newsletter" method="POST" data-netlify="true">
    <input type="hidden" name="form-name" value="newsletter">
    <label for="nl-email">Email</label>
    <input id="nl-email" name="email" type="email" required aria-required="true">
    <button class="cta cta--primary" type="submit">Subscribe</button>
  </form>
</dialog>
```

```js
const dialog = document.getElementById('newsletter');

if (dialog) {
  // Delayed and once-only. Fires in every loading state, so guard it.
  setTimeout(() => {
    if (!dialog.open && !sessionStorage.getItem('nl-seen')) {
      sessionStorage.setItem('nl-seen', '1');
      dialog.showModal();
    }
  }, 45000);

  // Reveal-on-scroll is enhancement only: without this the .reveal rule
  // never applies, so content is simply visible.
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }
}
```

No second modal, no exit-intent, no scroll trap beyond the platform's.

## Smooth scroll

CSS only, and only when the user asked for it.

```css
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}
```

## Responsive

Break at 768 and 1440. Use `clamp()` for type and section rhythm so there is
one rule rather than four.

- **375** — single column, no hover dependence, tap targets ≥44px, the nav
  collapses to a disclosure button with `aria-expanded`.
- **768** — two columns where it helps, 5/7 splits appear.
- **1440** — asymmetric layouts, the container caps at 76rem, imagery goes
  full-bleed while text does not.

Test all three. A section that only works at 1440 is a section that does not
work.

## Images

Always `width` and `height` attributes to reserve space — this is most of the
CLS budget. `loading="lazy"` and `decoding="async"` on everything below the
fold, never on the hero. Serve `srcset` at 1x/2x if you have the sources; with
SVG placeholders there is nothing to serve.

```html
<img src="assets/images/hero-banner.svg"
     width="1600" height="900"
     alt="Tight crop on a hand-finished brass hinge against dark walnut"
     fetchpriority="high">
```

## Lighthouse tactics

The target is 95 on mobile and desktop. What actually moves it:

- System fonts, or one preconnected `display=swap` import.
- One stylesheet, no `@import` inside it, no unused rules.
- Explicit `width`/`height` on every image.
- No third-party script, no tag manager, no chat widget.
- The form posts to Netlify; no client-side validation library.
- `prefers-color-scheme` left alone — a dark mode built for contrast is a
  second palette, and a luxury palette cannot afford to be improvised at
  midnight.
