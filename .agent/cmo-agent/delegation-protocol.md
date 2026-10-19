# Delegation Protocol — CMO → Content Planner Agent

The CMO never scrapes the web. Every research or calendar run is a written brief
handed to the Content Planner Agent.

## Handoff

1. Save the brief as `.agent/cmo-agent/briefs/brief-YYYY-MM-DD-<slug>.md`.
2. Tell the Content Planner Agent to execute it.
3. Content Planner writes to `.agent/content-planner/output/run-YYYY-MM-DD-<slug>/`.
4. CMO reviews that folder, edits lightly, then writes the marketing report.

## Brief format

```markdown
# Brief: <slug>

- **Goal:** one sentence, the marketing outcome
- **Campaign / period:** e.g. October 2026 intake, or "always-on, next 4 weeks"
- **Academies in focus:** list from the seven; default top 2–3
- **Channels:** instagram | linkedin | tiktok | youtube | blog | email (pick)
- **Language:** sq | en | both (both = separate posts, never mixed)
- **Audience:** prospective students | career switchers | parents/sponsors | B2B L&D
- **Research asks:** trending themes, competitor accounts, format patterns (optional)
- **Posts requested:** integer, default 12 (4 weeks × 3 posts)
- **Overrides:** pillars, banned topics, coordinator CTAs (optional)
- **Deadline:** when CMO needs the calendar back
```

## What Content Planner must return

Inside `output/run-<date>-<slug>/`:

- `research.json` + `research.md` — public-web findings with source URLs
  (omit folder half if the brief skips research)
- `calendar.md` — structured calendar per the playbook schema
- `calendar.json` — same rows, machine-readable
- `drafts/` — full draft captions for each calendar row (hook + caption + CTA)

Each calendar row needs: date, time, channel, format, pillar, academy, hook,
caption summary, CTA, language, asset needs, source URLs if research-backed.

## Rejection rules (CMO side)

Return the run without a report if:

- any claim lacks a public source URL or knowledge-base backing
- languages are mixed inside one draft
- production load exceeds the playbook weekly cap without flagging it
- hooks use banned patterns from the playbook
- the calendar ignores the brief's academies or channels

## Volume discipline

- One brief, one run. Do not stack unrelated campaigns in a single brief.
- Default 12 posts per 4-week calendar; hard max 20 unless the brief raises it.
- At most 3 posts per channel per week in always-on mode.
- Competitor research: max 8 public profiles or pages per run.
