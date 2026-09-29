# Copy and Tone

The page should read as though it already knows what the reader is thinking.
It is not persuasive because it argues; it is persuasive because it describes
the reader accurately and then gets out of the way.

## Voice

- **Confident, not declarative.** State the position and stop. "Curated to the
  room" — not "the finest bespoke kitchens in the country".
- **Specific over grand.** Concrete nouns beat adjectives: a material, a year, a
  process, a place. "Fired twice, in our own kiln" beats "impeccably fired".
- **Second person sparingly.** Prefer "the client" or a noun over "you" repeated
  every sentence. Luxury copy that says "you" nine times in a section is
  selling.
- **Short sentences after long ones.** Vary the rhythm. A paragraph of uniform
  medium-length sentences is the prose equivalent of a stiff grid.
- **Never explain the luxury words.** Curated, bespoke, artisanal, heritage,
  atelier, provenance, quietly. Use them as a person who is a member of the
  world would, and never with a definition following.

## Emotional target

Default: **serene confidence**. The reader should finish the page feeling
better-informed, not flattered. Alternatives: exclusive belonging, informed
discretion, quiet confidence, reassured permanence. Pick one and hold it — a
page that shifts register between sections feels assembled.

## Lexicon

**Use freely:** curated, bespoke, artisanal, heritage, atelier, provenance,
considered, enduring, singular, by hand, to order, the particular, the quiet.

**Never:** deal, discount, save, hurry, limited time, act now, best, number
one, world class, cutting edge, state of the art, revolutionary, seamless,
unlock, elevate, game changing, exclusive (as a bare adjective — "exclusive" is
what the client is, never what the brand claims), affordable, cheap, quality,
premium, luxury itself as a boast.

Extended by `avoided_terms` at intake. The standard list is never removed.

## Handling objections without raising them

The three objections a reader has and will not say out loud. Answer each once,
in passing, in a sentence. Never a dedicated section — a section titled
"why it's worth it" is the objection raised, which is worse than unaddressed.

- **Exclusivity** — *"A small number of commissions each season, so each
  receives the attention it needs."* Consequence, not brag. State the limit and
  let exclusivity be inferred.
- **Value for money** — *"Specified once, made once, and built to outlast the
  house it sits in. The cost is the beginning of a long return."* Reframe from
  price to horizon. Never mention money directly.
- **Time commitment** — *"A first conversation, then a proposal. Most clients
  are deciding within the month."* Name the actual process and its length. Vague
  process is the real objection; concrete process dissolves it.

## Section templates

Fill the `{{tokens}}` from intake. The shape matters more than the words.

### Hero

One headline stating the core benefit in the brand's own nouns. One subhead of
at most 22 words that names the material or the process, not the emotion. One
eyebrow of 2 to 4 words, uppercase, tracked. One primary CTA.

```
{{eyebrow}}                              2-4 words, uppercase
{{core_benefit_as_headline}}             4-9 words, sentence case
{{offering_description, trimmed}}        <=22 words
[Request a Private Consultation]          the single primary CTA
```

No centred text over a full-bleed photo. Offset the image, crop it tight, or
let the headline sit in a column with the image beside it.

### Value proposition

Headline plus a short paragraph that describes what the client ends up with.
Followed by three or four one-line statements, set as a list with hairline
rules — not as icon cards.

### Credibility

This section is **entirely placeholder** until the user supplies real proof.
Every item carries `data-placeholder="social-proof"`, a visible editorial
marker, and a line in the handoff.

```html
<figure data-placeholder="social-proof">
  <blockquote>{{anonymised_quote, in the client's own words}}</blockquote>
  <figcaption data-placeholder="attribution">
    {{client_descriptor}} — {{year}}
  </figcaption>
</figure>
```

Anonymise to something that still carries weight: "Private client, London,
2023" or "Restaurateur, Lisbon". Never invent a name, an outlet, an award, or a
year. A page claiming a Vogue feature that did not happen is not a placeholder,
it is a problem.

### Offerings

Three, in the order given at intake, descending in importance. Offering one
gets the most space, typically as a wide asymmetric row with an image; three
gets a single line. Each has a name, a sentence on what it is, a sentence on
what the client gets, and a link that does not start a new tab.

### Closing CTA

Short, calm, one primary CTA, and the reassurance that the first step is small.
No urgency, no countdown, no second competing button.

### Footer

Address, contact, and the small legal line. A sitemap if there is more than one
page. Social links only if they exist, labelled properly, opening in a new tab
with `rel="noopener noreferrer"`. An understated wordmark, not a logo parade.

## Imagery alt text

Descriptive and specific, written as if for someone who cannot see the page.
"Tight crop on a hand-finished brass hinge against dark walnut" — not "luxury
interior" and never a filename. Decorative images take `alt=""` and nothing
else. Every placeholder image gets alt text that describes the intended shot,
so the user knows what to replace it with.
