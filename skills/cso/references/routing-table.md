# Sub-Agent Routing Table

The CSO routes to exactly the five sub-agents below and nothing else. The top-level
`config/skills.json` knows `cso` as a single route target; this file is the CSO's private
registry, the sub-orchestrator layer beneath it. Load it before classifying any intent.

## Routing map

| Route to | Owns | Intent / signal | Required parameters | Backing skills |
| --- | --- | --- | --- | --- |
| `pipeline` | CMO-lead intake, CRM records, stage tracking, dedup, ownership, hygiene | intake leads, accept/disqualify, dedup, move a stage, stale pipeline | `leads`, `program` | `google-workspace-cli`, `hindsight-memory` |
| `outreach` | multi-touch outreach and follow-up drafts | first touch, follow-up, sequence, reply handling, re-engage | `lead_refs`, `channel`, `program` | `humanizer`, `social-post`, `google-workspace-cli` |
| `discovery` | call booking and prep, qualification, no-show recovery | book a call, prep a discovery call, qualify fit, handle a no-show | `lead_refs`, `program` | `google-workspace-cli`, `task-scheduling` |
| `closing` | offers, objections, proposals, enrollment, referrals | draft an offer, handle an objection, close enrollment, ask for a referral | `lead_refs`, `program`, `cohort` | `humanizer`, `google-workspace-cli` |
| `revenue-analytics` | rates, CAC, revenue, forecast, weekly roll-up, stalled flags | conversion rate, CAC, revenue, forecast, stalled deals, weekly sales roll-up | `campaign` or `program`, `window` | `plausible-analytics`, `google-workspace-cli` |

## Querying rules

1. Match on sub-agent name, then `owns`, then intent signal - in that order of confidence lift.
2. Score in [0.00, 1.00]. `>= 0.80` is a direct match; below that enters the clarification loop.
3. A dispatch touching more than one stage must be split into sequential sub-tasks with an
   explicit order and dependency notes (discovery before closing, pipeline before outreach).
4. Never route outside these five. Marketing-shaped work goes back to the orchestrator for
   `cmo`; anything else has no route here.

## Sub-agent contracts

Each sub-agent's full definition and output contract lives in its own file. Read the target
file before dispatching so the payload matches what the sub-agent can actually produce.

- `agents/pipeline/SKILL.md`
- `agents/outreach/SKILL.md`
- `agents/discovery/SKILL.md`
- `agents/closing/SKILL.md`
- `agents/revenue-analytics/SKILL.md`

## Adding a sub-agent

Only the skill-builder workflow may add one. When it does, produce the entry here, a matching
`agents/<name>/SKILL.md`, and a matching `sub_skills` entry in the `cso` record inside
`config/skills.json`, then re-read this file to keep the taxonomy coherent.
