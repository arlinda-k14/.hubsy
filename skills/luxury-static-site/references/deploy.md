# Deploy

## The short path

Drag the project folder onto <https://app.netlify.com/drop>. There is no build
command, no publish directory to configure, and no environment variables. The
folder *is* the site. This is the whole deployment story and it is the reason
the skill forbids frameworks.

## What Netlify needs from you first

- **Site name** — set it to the brand, not a random slug. It becomes the
  subdomain and the page title in search results.
- **Forms** — open the Forms tab and confirm the `enquiry` form was detected,
  then set the notification email. Submissions go nowhere until you do.
- **HTTPS and the auto-generated domain** are on by default. Leave them.

## Forms need a re-deploy

Netlify parses forms at deploy time, not at request time. A form added after
the last deploy will submit to nothing. After any form change, redeploy — this
is the single most common "the form does nothing" cause, and it belongs in the
handoff checklist every time.

## Optional: netlify.toml

Not needed for a drag-and-drop deploy. Worth committing when the site grows
past one page, or when you want caching headers so repeat visits skip the
network.

```toml
[build]
  publish = "."
  command = ""

[[headers]]
  for = "/styles.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    X-Frame-Options = "DENY"
```

Add `<link rel="preload" as="style" href="styles.css">` in the head if you add
immutable caching, so a repeat visit does not wait on a round trip for CSS.

Do not set a `Content-Security-Policy` unless the user asks. A wrong CSP
silently blocks the form and costs more than it prevents.

## Multiple pages

Add one file per page — `services.html`, `about.html`, `contact.html` — and
link them in the header. Every page gets the same `styles.css` and the same
skip link. When a page is built, tell the user which navigation entries now
exist, because a link to an unbuilt page is a 404 they will find before you do.

## Post-deploy checks

Run through these before calling it done:

1. The form submits and a confirmation appears (not Netlify's generic page —
   add a `success.html` and point `action` at it if you want a branded
   confirmation).
2. The notification email arrived.
3. Every internal link resolves. No 404s.
4. The site loads on a real phone, on mobile data, not just on localhost.
5. Keyboard only: tab through the header, the CTAs, and the form. You should
   never lose the focus ring.
6. Lighthouse on the deployed URL, mobile and desktop, against the target.

## After real content lands

Images replace the SVG placeholders and should be exported at 2x, WebP or AVIF,
with the existing `width`/`height` attributes kept so the layout does not
shift. Real testimonials and awards replace the `data-placeholder` elements,
and the `data-placeholder` attribute comes off in the same edit — leaving it on
after the real content is in is how a placeholder becomes a permanent artefact.
