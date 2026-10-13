# Quality Rubric

Every draft a sub-agent returns is scored **before** it leaves the CMO. The score is out of
10. **Anything below 8/10 goes back to the same sub-agent with specific revision notes.**

## Scoring (10 points)

| Criterion | Points | What earns full marks |
| --- | --- | --- |
| Clear hook | 4 | First line or first frame makes the target reader stop. Specific, not clever. |
| Concise educational points | 3 | Each point teaches something true and useful. No filler, no padding, no restating the hook. |
| Direct call to action | 3 | Exactly one CTA, unambiguous, pointing at the program inquiry form unless the brief says otherwise. |

Deduct automatically for any guardrail violation (see `guardrails.md`) - a single banned claim
caps the piece at 0 and it is rewritten, not revised.

## Revision notes

Notes sent back to a sub-agent must be actionable and tied to a criterion: which line, which
criterion, what to change. "Make it better" is not a revision note and must not be sent.

## Conflict with the sub-agent

If a sub-agent disputes the score, the CMO re-reads the draft against this rubric and either
revises the score with a reason or holds it. Scores are not negotiated down to avoid a second
round; the bar is the bar.

## Worked example

> **Draft scored 6/10.** Hook opens with the academy's founding year, not the reader's
> problem (hook: 2/4). Middle restates the hook twice (educational: 2/3). CTA reads "Learn
> more" with no destination (CTA: 2/3). Revision: open from the reader's stuck career, cut the
> repeated paragraph, point the CTA at the inquiry form for the Digital Marketing cohort.
