# Quality Rubric

Every draft a sub-agent returns is scored **before** it leaves the CSO. The score is out of 10.
**Anything below 8/10 goes back to the same sub-agent with specific revision notes.**

## Scoring (10 points)

| Criterion | Points | What earns full marks |
| --- | --- | --- |
| Fit and qualification accuracy | 4 | The piece is grounded in the lead's actual signal or stated goal. No invented budget, timeline, or intent. Right stage, right program, right ask for where the deal really is. |
| Single clear ask | 3 | Exactly one unambiguous next step, pointing at the discovery call or the enrollment decision. No multi-question walls, no vague "let me know". |
| Human, on-brand voice | 3 | Reads like a person wrote it, anchored in the four message anchors. No hype, no pressure, no AI tells, no banned claims. |

Deduct automatically for any guardrail violation (see `guardrails.md`) - a single banned claim
caps the piece at 0 and it is rewritten, not revised.

## Revision notes

Notes sent back to a sub-agent must be actionable and tied to a criterion: which line, which
criterion, what to change. "Make it better" is not a revision note and must not be sent.

## Conflict with the sub-agent

If a sub-agent disputes the score, the CSO re-reads the draft against this rubric and either
revises the score with a reason or holds it. Scores are not negotiated down to avoid a second
round; the bar is the bar.

## Worked example

> **Draft scored 6/10.** Outreach opens with the program's features instead of the lead's stated
> goal of switching out of retail (fit: 2/4). The message asks the lead to book a call and also
> to reply with their CV and salary expectation (single ask: 1/3). Voice is clean and on-brand
> (voice: 3/3). Revision: open from the retail-to-marketing switch the lead actually posted
> about, cut everything but the single ask to book the discovery call, keep the body.
