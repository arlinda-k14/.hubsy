---
name: career-switch-lead-scout
description: Discover, filter, score, and queue prospective students seeking entry-level AI and marketing training from public social posts (LinkedIn, Reddit, Facebook) restricted to target regions (Kosovo + worldwide remote). Detect signals like 'open to work', 'career pivot', 'seeking entry level', 'looking for new path'. Use whenever the user wants to find and qualify job-seeker leads for a beginner digital/AI/marketing bootcamp, build a live prospect queue, deduplicate leads over a 90-day window, draft non-technical outreach for qualified candidates, run as a scheduled 07:00 daily intake with a 6-hour queue resync, or review staged leads in CSV/PDF. Trigger whenever lead generation, career-transition prospecting, or entry-level student recruiting is mentioned, even if 'lead-scout' is not named.
---

# Career-Switch Lead Scout

Automated lead generation and qualification engine that identifies unemployed individuals seeking a
career transition into entry-level digital roles and evaluates them for a beginner-focused AI and
marketing training program.

Pipeline outcomes are never auto-messaged to prospects: every qualified lead gets a drafted,
non-technical outreach message placed in a review queue (`output/staged_leads_<date>.csv` / `.pdf`)
for human verification and sign-off.

## Input Parameters

- `source` (string, required): `linkedin`, `reddit`, or `facebook`.
- `limit` (integer, optional, default 50, max 100): maximum candidate intake per run.
- `target_region` (string, optional): regional filter, e.g. `kosovo`, `remote` (config regions also apply).
- `dry_run` (boolean, optional, default false): prints staged records without writing the database or output files.

## Scheduled Operation

The pipeline is installed as two cron jobs (see `~/.hubsy/config/` notes or `crontab -l`):

- `0 7 * * *`  -> `scripts/run_daily.sh` (main intake: fetch linkedin, reddit, facebook -> score -> stage)
- `0 */6 * * *` -> `scripts/run_queue.sh` (re-score latest raw data, merge dedup contacts, re-emit outputs)

Manual invocation:
```
claude run career-switch-lead-scout --source reddit --limit 50 --target-region kosovo --dry-run
```

## Source Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| Reddit   | Real fetcher present (public search JSON) | Enabled + `user_agent` in config when ready |
| LinkedIn | Scaffold, token-gated | No open discovery API; needs private-app token or CSV export |
| Facebook | Scaffold, token-gated | Needs Graph API access token with group membership |

Without credentials the fetcher falls back to a clearly flagged mock provider
(`candidates[*].source == "mock"`) so the full pipeline stays testable.

## Execution Logic

1. Read parameters; confirm config (`config/lead_sources.json`) API connections and database path.
2. Load the 90-day dedup set from `data/dedup_cache.sqlite` (profile URLs + SHA-256 email hashes).
3. Pull posts/profiles matching intent keywords ('open to work', 'career pivot', 'career transition',
   'seeking entry level', 'looking for new path', 'break into tech', 'no experience').
4. Restrict discovery to permitted regions: **Kosovo** or **remote worldwide** (config `regions`).
5. Discard profiles exceeding 2 years direct experience in digital marketing, ML, or software
   engineering; drop candidates demanding immediate headhunting placement, reporting under 5h/week
   study availability, or seeking passive results.
6. Score remaining candidates 1-100 on: study commitment (40%), intent to invest in retraining (35%),
   alignment with target entry roles (25%).
7. Draft tailored outreach for leads scoring >= 70 (English default; Albanian for Kosovo/Albania
   profiles), then insert qualified leads into the staging queue output.
8. Enforce a hard daily ceiling of 100 newly qualified profiles per source platform; halt that
   platform for the day when reached.

## Target Roles & Offer Framing

Target roles: **AI Marketing Assistant**, **Content Operations Specialist**, **Junior Growth Marketer**,
**Freelance AI Copywriter**. Tuition framing: $1,500 upfront **or** 15 installments of $100.
Address beginner concern explicitly: zero coding, plain-English prompts, everyday tools, step-by-step guidance.

## File Operations

- Read `./config/lead_sources.json` - endpoints, region keywords, scoring weights, caps.
- Read/Write `./data/dedup_cache.sqlite` - 90-day URL/email-hash dedup + per-platform daily intake slots.
- Write `./output/staged_leads_<date>.csv` and `./output/staged_leads_<date>.pdf` (PDF only if
  `reportlab` is installed) - staged records with outreach drafts for manual review.
- Error artifacts: `./logs/errors.log`, `./data/failed_sync_<timestamp>.csv`.

## Shell Commands

```
python3 scripts/fetch_candidates.py --source linkedin --limit 50 --out ./data/raw.json
python3 scripts/score_and_filter.py --in ./data/raw.json --db ./data/dedup_cache.sqlite --min-score 70
bash scripts/run_daily.sh    # 07:00 cron
bash scripts/run_queue.sh    # every 6h cron
```

(All relative paths are relative to the skill folder `~/.hubsy/skills/career-switch-lead-scout/`.)

## Output Format

Produce a validated record listing for each lead: **Full Name, Profile URL, Location, Detected Status,
Background Industry, Commitment Hours, Score (1-100), Language, Draft Outreach Message**, plus
source platform, public email, and career goal for the review queue.

## Error Handling

- **HTTP 429**: pause immediately, record timestamp in `logs/errors.log`, create
  `data/cooldown_<source>.lock`, and halt ingestion for that platform for 60 minutes
  (`fetch_candidates.py` checks the lock before fetching).
- **Database/output failure**: save processed records to `data/failed_sync_<timestamp>.csv` and
  exit with code 1 so the scheduler can surface the failure.
- **Platform without credentials**: log the reason to `errors.log` and proceed on remaining platforms.

## Safety & Consent Rules

- Never dispatch messages to prospects directly; always leave drafted outreach in the review queue.
- Never ask candidates for personal income; filter on expressed willingness to invest in retraining.
- Drop or merge contacts whose profile URL or email hash was seen within the preceding 90 days.
- Keep intake within the per-platform daily ceiling (50-100) to avoid rate limits and intake overload.
- Respect platform terms of service; discover only from public posts and designated groups.