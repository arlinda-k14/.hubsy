# Intake

One interview per site. Ask once, ask well, and infer the rest.

The original brief said to ask for every missing field in one numbered message
and stop. That is correct for a chatbot with no memory and no follow-up, and
wrong for a working session where the user can just... answer. Stalling on
fourteen questions when three of them block everything and eleven can be
reasonably inferred is a bad trade. So: **three hard blocks, everything else
inferred and disclosed.**

## The three hard blocks

No defensible default exists. If any is missing you ask and you stop.

1. **Brand name** — the literal string as it should appear. Ask for
   capitalization and any accent marks, and whether it has a descriptor line
   ("Maison Aurelle" / "Private Interiors, est. 1998").
2. **Industry** — the specific niche, not the category. "Luxury real estate" is
   usable; "property" is not. Push gently for the narrow version: "which
   segment?".
3. **Offering description** — what is actually sold, in a sentence, including
   what the client gets. "We design and install bespoke kitchens for private
   residences" is usable. "Kitchen design" is not.

Ask all three in a single message. Do not ask them one at a time.

## Everything else

Derive these from the three hard blocks, state your reading plainly, and keep
going. The user corrects what is wrong faster than they fill in a form.

**core_benefit** — the outcome the client is buying, not the feature delivered.
Read it off the offering. If the offering is "bespoke kitchen installation" the
benefit is "a kitchen that fits the room and lasts a generation", not "custom
cabinetry".

**offerings** — exactly three, in descending order of importance to the
business. The first is what most clients buy and should carry the most space
in the page. The third can be a narrower or premium tier. Never invent a fourth.

**audience** — all three parts, derived from industry plus offering:

- *demographics* — age band, income or wealth bracket, geography, and whether
  they are individuals or institutional buyers.
- *psychographics* — how they make decisions, what they fear looking like, what
  they already own that this must not resemble.
- *values* — the three to five things they rank above price.

**colors** — 2 to 3 core values plus neutrals. Deep or warm, never loud brights.
If the user says "elegant, you decide", choose a warm-neutral ground with a
single restrained accent and say so in the design direction. A luxury palette is
a decision, not an inheritance.

**inspiration** — a named aesthetic with a source. "Minimalist Scandinavian with
Japanese artisanal detail" is a direction. "Modern" is not. If the user has
none, derive it from the industry: craft and material trades lean editorial and
textural, hospitality leans atmospheric and photographic, professional services
lean structural and typographic.

**imagery_themes** — the qualities being shown and the vehicles for showing
them. Prefer crafted objects, natural landscape, or abstract texture over direct
product shots. The brief is explicit: placeholders need tasteful crops and
descriptive alt text, and a luxury placeholder of a stock handshake undoes the
whole premise.

**social_proof_types** — which proof types the brand will actually have.
Anonymized testimonials, publication mentions, industry awards, longevity,
client retention, named institutional clients. Pick types, never fabricate
instances. The content is a placeholder the user fills.

**primary_cta** — the action the page exists to produce. Default: "Request a
Private Consultation". It must lead to the inquiry form.

**emotional_target** — the feeling after reading. Default: serene confidence.
Alternatives: exclusive belonging, informed discretion, quiet confidence,
reassured permanence.

**imagery_assets** — how to handle images. Default: local SVG placeholders with
the correct aspect ratio and a descriptive label baked in. Do not generate
binary files, and do not hotlink.

**inquiry_form_backend** — default Netlify Forms, detected by
`data-netlify="true"`. No server, no build step, works on drag-and-drop deploy.

**form_fields** — name, email, phone (optional), interest, message. Label every
one, mark required with `required` and `aria-required` rather than an asterisk
alone.

**avoided_terms** — extends the standard list in `copy-and-tone.md` with
anything the brand has banned. The standard list is never removed.

## Resolvable technical defaults

| Field | Default |
|---|---|
| `wcag_level` | WCAG 2.2 AA |
| `lighthouse_target` | 95 on mobile and desktop |
| `pages` | `index.html` only |
| `js_features` | `[]` |
| `heading_font` | system serif stack |
| `body_font` | system sans stack |
| `breakpoints` | 375 / 768 / 1440 |

## How to ask

- One message, numbered, concrete. "What is the brand name, the specific niche,
  and what do you sell in a sentence?" beats fourteen bullet questions.
- Never accept a category where a niche belongs, or a feature where a benefit
  belongs. Ask once more, then move on.
- If the user says "you pick", pick. Deciding is the job. Then state the choice
  so it is easy to override.
- If the user says "just build it", build it. Disclose every assumption in the
  handoff and move on. Do not re-ask.

## Detecting unfinished fields

Treat a value as filled only if it is concrete. These are not filled:

- The question restated — "just tell me about the luxury offering"
- Category without niche — "interiors" for a brand doing marine joinery
- Vague adjectives standing alone — "elegant", "premium", "high-end"
- Restated examples from this document
- "TBD", "placeholder", "whatever", "same as above"

A bracketed token or an unfilled `{{field}}` is always unfinished.
