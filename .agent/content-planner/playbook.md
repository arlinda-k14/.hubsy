# Content Playbook — Creative Hub Kosovo

Used by the Content Planner Agent for research synthesis, calendars, and drafts.
CMO enforces it on review.

## Content pillars

| Pillar | Share | What it covers |
|--------|------:|----------------|
| Career outcomes | 30% | alumni jobs, hiring partners, portfolio proof, "where they work now" |
| Skill previews | 25% | 1 concrete skill from an academy taught in plain language |
| Behind the academy | 20% | campus, live sessions, instructors at work, student projects |
| AI culture / trends | 15% | public AI/education trends tied back to our programs |
| Enrollment moments | 10% | intake dates, installments, how to apply, meet the coordinators |

Never let enrollment moments exceed 20% of a 4-week calendar.

## Channel defaults

| Channel | Format norms | Language default |
|---------|--------------|------------------|
| Instagram | reels 20–45s, carousels 7–10 slides, single image rare | sq for student-facing |
| LinkedIn | text + document carousels, short native video | en for B2B/credibility; sq for local |
| TikTok | raw talking-head or screen recording, 15–35s | sq |
| YouTube | long-form 6–12min or shorts | en for Vibe Coding; sq otherwise |
| Blog | 700–1200 words, SEO title + one CTA | en or sq per brief |

Max 3 posts per channel per week (always-on). Campaign bursts may hit 4 if the
brief says so and production capacity is noted.

## Hook patterns that work for this brand

- Outcome-first: "3 jobs our data grads landed this month" (only if true)
- Skill-in-60-seconds: name one tool or technique, show one step
- Myth-break: "You do not need a CS degree for full-stack" (back it with proof)
- Day-in-the-life: student or instructor, one real session
- Before/after: project from week 1 vs week 8
- Question that names the fear: "Stuck in a dead-end job at 28?"

### Banned hook patterns

- "This will change everything"
- "POV: you just discovered the secret to..."
- "Nobody is talking about this"
- Fake countdown pressure without a knowledge-base date
- Engagement bait ("comment YES if...")
- Any hook that requires a fact we cannot source

## Caption structure

1. Hook line (same as calendar hook or tighter)
2. Body: 2–6 short sentences, one idea, concrete detail
3. CTA: one only (apply, save, share with a friend, comment a word, book info day)
4. Hashtags: 3–5 max, mix Albanian and English tags only when the post language
   is English; otherwise keep tags in the post language plus brand tags
   (#CreativeHubKosovo #CreativeHubAcademy)

Post language rules match the Hubsy widget: never mix Albanian and English
inside one caption.

## Scheduling defaults

- Instagram/TikTok: 12:00–13:00 or 19:00–21:00 Europe/Prishtina on weekdays;
  Sat morning for softer stories/recaps
- LinkedIn: Tue–Thu 08:30–10:00 Europe/Prishtina
- Never stack the same academy two days in a row on one channel
- Intake weeks: front-load enrollment pillar in the first 5 days of the window

## Coordinator CTAs (when a human face helps)

- Flaka Dermaku — Data Engineering, Vibe Coding, Full-stack, Product Management
- Leonita Krasniqi — Data Science, Digital Marketing, HR
- Point to Calendly or the site apply page. Never paste personal phone numbers
  into public captions.

## Calendar row schema

```json
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "timezone": "Europe/Prishtina",
  "channel": "instagram",
  "format": "reel | carousel | image | text | video | article",
  "pillar": "career-outcomes | skill-preview | behind-the-scenes | ai-trends | enrollment",
  "academy": "digital-marketing | data-eng | data-science | fullstack | product | hr | vibe-coding | none",
  "language": "sq | en",
  "hook": "full hook line",
  "caption_summary": "one sentence on the body",
  "cta": "single CTA",
  "asset_notes": "what the designer/editor needs",
  "sources": ["public URLs if research-backed"],
  "status": "draft"
}
```

## Draft file schema (`drafts/<date>-<channel>-<slug>.md`)

```markdown
# <date> — <channel> — <topic>

- Pillar / academy / format / language
- Sources: ...

## Hook

## Caption

## CTA

## Hashtags

## Asset notes

## Review checks

- [ ] facts match knowledge base
- [ ] single language
- [ ] single CTA
- [ ] no banned phrases
```
