# Delegation Protocol — CSO → Lead Gen Agent

The CSO never researches the web directly. Every discovery run is a written brief
handed to the Lead Gen Agent.

## Handoff

1. Save the brief as `.agent/cso-agent/briefs/brief-YYYY-MM-DD-<slug>.md`.
2. Tell the Lead Gen Agent to execute it (same session or next turn).
3. Lead Gen writes results to `.agent/lead-gen-agent/output/run-YYYY-MM-DD-<slug>/`.
4. CSO reviews that folder, then writes the executive report.

## Brief format

```markdown
# Brief: <slug>

- **Goal:** one sentence, the sales outcome
- **Academy fit:** which academies this prospect set should map to
- **ICP:** follow `.agent/lead-gen-agent/icp.md` unless overridden below
- **Overrides:** region, keywords, exclude list, language (optional)
- **Sources:** public web only (company sites, public profiles, public posts)
- **Max prospects:** integer, default 15
- **Max pages per prospect:** integer, default 3
- **Deliverables:** prospect table, scoring, outreach drafts for score >= 70
- **Deadline:** when the CSO needs the run back
```

## What Lead Gen must return

Inside `output/run-<date>-<slug>/`:

- `prospects.json` — machine-readable prospect records
- `prospects.md` — same records as a review table
- `outreach/` — one draft file per qualified prospect (email + one follow-up)

Each prospect record needs: name, role/title, organization, public URL, region,
academy fit, score (1–100), signals (why they match), language, contact channel
found publicly (email or profile URL — never guessed).

## Rejection rules (CSO side)

Return the run to Lead Gen without a report if:

- any record lacks a public source URL
- contact emails were inferred rather than found on a public page
- more than 20% of records are below the ICP fit line
- outreach drafts use spam language from `.agent/lead-gen-agent/outreach-playbook.md`
  banned list

## Volume discipline

- One brief, one run. Do not stack conflicting goals in a single brief.
- Hard ceiling: 100 new profiles scanned per source platform per day.
- Dedup against the 90-day window already used by `skills/career-switch-lead-scout`
  when that skill's data dir is present.
