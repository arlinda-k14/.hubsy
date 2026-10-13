# Weekly Summary Schema

One summary per week, assembled every Monday. It is the only artifact a human reads to judge
the week, so it stays skimmable: what shipped, what waits, what moved, what is broken, what is
next.

## Sections

1. **Header** - week commencing (Monday, CET), generated-at timestamp.
2. **Completed per sub-agent** - approved briefs grouped by owner, with `brief_id`.
3. **Drafts awaiting approval** - every `drafted` brief, with owner and deadline. This is the
   queue Arlinda acts on.
4. **Metric movement** - per campaign: lead volume, form completions, cost per lead, and the
   week-over-week delta. Missing data is written `n/a`, never estimated.
5. **Flagged underperformers** - items flagged by `analytics`, with the evidence and the CMO's
   proposed action.
6. **Conflicts and escalations** - unresolved sub-agent disagreements and any guardrail issue,
   with the rationale.
7. **Next-week priorities** - the top three objectives, each with an owning sub-agent.

## Template

Filled from `templates/weekly-summary.md`. The struct:

```json
{
  "week_of": "2026-10-13",
  "generated_at": "2026-10-13T07:00:00+01:00",
  "completed":   {"content-strategy": ["brief_id"], "social-media": ["brief_id"],
                  "lead-generation": ["brief_id"], "analytics": ["brief_id"]},
  "awaiting_approval": [{"brief_id": "...", "owner": "...", "deadline": "..."}],
  "metrics": [{"campaign": "...", "leads": 0, "forms": 0, "cpl": null,
               "leads_delta": 0, "forms_delta": 0, "cpl_delta": null}],
  "flags": [{"item": "...", "reason": "...", "proposed_action": "..."}],
  "escalations": [{"topic": "...", "positions": ["..."], "recommendation": "..."}],
  "next_week": [{"objective": "...", "owner": "..."}]
}
```

## Rules

- A campaign appears in `metrics` even when its numbers are missing, so absence is visible.
- `awaiting_approval` is never empty-and-omitted; if empty, say so explicitly.
- The summary is a draft artifact. It is not sent anywhere until Arlinda approves it.
