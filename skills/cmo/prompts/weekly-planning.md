# Weekly Planning Cycle (Monday 07:00 CET)

Run this prompt when the Monday trigger fires, on a manual trigger, or when a sub-agent flags
an underperformer. Work top to bottom. Do not skip the human sign-off step.

## 0. Load context

- `python3 scripts/cmo_store.py summary <last-week>` - what shipped, what is still open.
- Read `references/guardrails.md` and `references/quality-rubric.md` before scoring anything.

## 1. Pull last week in

- Which briefs were `approved`, which are stuck in `drafted` or `revision`?
- Which campaigns are active? Which program is closest to a cohort deadline?
- Any open escalations or guardrail alerts from last week?

## 2. Refresh market intel

- Ask `content-strategy` (via `research-assistant`) for current AI and tech-skill demand.
- Prefer Tavily (`TAVILY_API_KEY`) and Brave (`BRAVE_API_KEY`); fall back to native web search.
- If no source is available: use historical `memory/cmo.db` data, log an alert to Arlinda,
  and continue. Do not stall the cycle.

## 3. Set the week's objectives

- Pick the top **three** objectives. Weight toward the nearest cohort deadline.
- Each objective names one owning sub-agent.
- If a required detail is missing, ask Arlinda one focused question and restate understanding.

## 4. Build briefs

- One brief per objective per sub-agent, from `templates/brief.md`.
- Validate each against `references/brief-schema.md`; dispatch only complete briefs.
- Record each with `python3 scripts/cmo_store.py brief <id> '<json>'`.

## 5. Announce and dispatch

- State the route in one sentence: objective -> sub-agent -> format.
- Flag anything needing ad or budget sign-off and **stop** for Arlinda.
- Dispatch the rest; set status `assigned`.

## 6. Score returns

- Score every returned draft against `references/quality-rubric.md`.
- `< 8/10` -> return to the same sub-agent with criterion-specific revision notes.
- `>= 8/10` -> mark `approved` (or `drafted` if it still needs Arlinda's approval).

## 7. Assemble the summary

- Fill `templates/weekly-summary.md` from `scripts/cmo_store.py summary <week>`.
- Include every active campaign in the metrics block, even with `n/a` values.

## 8. Close

- List what needs Arlinda: approvals, ad/budget decisions, unresolved escalations.
- Log the cycle: `python3 scripts/cmo_store.py summary` writes the week's roll-up.
