# Weekly Summary Schema

One summary per week, assembled every Monday. It is the only artifact a human reads to judge
the week, so it stays skimmable: what shipped, what waits, what moved, what is broken, what is
next.

## Sections

1. **Header** - week commencing (Monday, CET), generated-at timestamp.
2. **Completed per sub-agent** - approved briefs grouped by owner, with `brief_id`.
3. **Drafts awaiting approval** - every `drafted` brief, with owner and deadline. This is the
   queue Arlinda acts on.
4. **Funnel movement** - per campaign and program: accepted, calls, offers, won, revenue, CAC,
   the week-over-week deltas, and the derived rates. Missing data is written `n/a`, never
   estimated.
5. **Flagged stalled deals** - items flagged by `revenue-analytics`, with the evidence and the
   CSO's proposed action.
6. **Conflicts and escalations** - unresolved sub-agent disagreements and any guardrail or
   handoff issue, with the rationale.
7. **Next-week priorities** - the top three objectives, each with an owning sub-agent.

## Template

Filled from `templates/weekly-summary.md`. The struct:

```json
{
  "week_of": "2026-10-13",
  "generated_at": "2026-10-13T08:00:00+01:00",
  "completed":   {"pipeline": ["brief_id"], "outreach": ["brief_id"],
                  "discovery": ["brief_id"], "closing": ["brief_id"],
                  "revenue-analytics": ["brief_id"]},
  "awaiting_approval": [{"brief_id": "...", "owner": "...", "deadline": "..."}],
  "metrics": [{"campaign": "...", "accepted": 0, "calls": 0, "offers": 0, "won": 0,
               "revenue": 0, "cac": null,
               "accepted_delta": 0, "calls_delta": 0, "offers_delta": 0,
               "won_delta": 0, "revenue_delta": 0, "cac_delta": null}],
  "flags": [{"item": "...", "reason": "...", "proposed_action": "..."}],
  "escalations": [{"topic": "...", "positions": ["..."], "recommendation": "..."}],
  "next_week": [{"objective": "...", "owner": "..."}]
}
```

## Rules

- A campaign appears in `metrics` even when its numbers are missing, so absence is visible.
- `awaiting_approval` is never empty-and-omitted; if empty, say so explicitly.
- Handoff gaps from the CMO (qualified leads expected but not received) appear in
  `escalations`, not silently dropped.
- The summary is a draft artifact. It is not sent anywhere until Arlinda approves it.
