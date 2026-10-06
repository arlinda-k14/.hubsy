# Confidence rubric

Assign exactly one rating to every finding in the **Findings** section. Ratings are about the
*claim*, not the source's prestige.

## High
- Corroborated by **two or more independent sources**, at least one of which is primary evidence:
  - GitHub repository activity (stars, commits, contributors, release cadence)
  - Official product usage/download figures (PyPI, npm, vendor-published MAUs)
  - Named developer or industry surveys with a published methodology (Stack Overflow Survey,
    Octoverse, WEF Future of Jobs, Eurostat, national statistics offices)
  - Actual job postings counted or aggregated by a platform with stated coverage
- Numbers match across sources, or differences are explainable (different date ranges).

## Medium
- One reputable secondary source, or two secondary sources agreeing, but no primary data.
- Vendor claim that is at least corroborated by independent reporting or usage signals.
- Job-market claims from a single platform with reasonable coverage of the region.

## Low
- Single secondary source; no independent corroboration; methodology unknown.
- Regional inference drawn from a global figure without local validation.
- Claims about Kosovo/Balkans sourced only from pan-European summaries.

## Speculative
- Vendor marketing claims ("revolutionary", "disrupting", "10x") with **no adoption data**.
- Roadmap or announcement without a shipped product or measured usage.
- Expert prediction or forecast presented as fact.
- Anything where the only source is the party selling the thing being claimed.

## Rules
- Every Speculative item must appear under **Hype and Unverified Claims**, not in Findings,
  unless an independent source upgrades it first.
- If cross-referencing is impossible (only one source retrieved), the ceiling is **Medium**.
- A claim with no retrieved source URL cannot be rated — it is dropped or moved to
  **Data Gaps**.
