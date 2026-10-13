# Weekly Pipeline Review (Monday 08:00 CET)

Run this prompt when the Monday trigger fires, on a manual trigger, or when a sub-agent flags a
stalled deal or a falling conversion rate. Work top to bottom. Do not skip the human sign-off
step. The CSO's cycle runs one hour after the CMO's so the CMO's weekly summary is available
input.

## 0. Load context

- `python3 scripts/cso_store.py summary <last-week>` - what shipped, what is still open.
- `python3 scripts/cso_store.py pipeline` - current deals by stage.
- Read `references/guardrails.md` and `references/quality-rubric.md` before scoring anything.

## 1. Pull last week in

- Which briefs were `approved`, which are stuck in `drafted` or `revision`?
- Which campaigns and programs are active? Which cohort deadline is nearest?
- Any open escalations or guardrail alerts from last week?

## 2. Reconcile the CMO handoff

- Compare the CMO's weekly summary (qualified leads staged) against what `pipeline` accepted.
- Any lead not accepted or explicitly disqualified is a gap. Log it, do not silently drop it.
- If the handoff is missing entirely, log an alert to Arlinda and continue on local data.

## 3. Set the week's objectives

- Pick the top **three** objectives. Weight toward the nearest cohort deadline and toward the
  stage where the funnel leaks most.
- Each objective names one owning sub-agent.
- If a required detail is missing, ask Arlinda one focused question and restate understanding.

## 4. Build briefs

- One brief per objective per sub-agent, from `templates/brief.md`.
- Validate each against `references/brief-schema.md`; dispatch only complete briefs.
- Record each with `python3 scripts/cso_store.py brief <id> '<json>'`.

## 5. Announce and dispatch

- State the route in one sentence: objective -> sub-agent -> format.
- Flag anything needing outbound, offer, price, or seat sign-off and **stop** for Arlinda.
- Dispatch the rest; set status `assigned`.

## 6. Score returns

- Score every returned draft against `references/quality-rubric.md`.
- `< 8/10` -> return to the same sub-agent with criterion-specific revision notes.
- `>= 8/10` -> mark `approved` (or `drafted` if it still needs Arlinda's approval).

## 7. Assemble the summary

- Fill `templates/weekly-summary.md` from `scripts/cso_store.py summary <week>`.
- Include every active campaign and program in the metrics block, even with `n/a` values.

## 8. Close

- List what needs Arlinda: approvals, outbound/offer/price/seat decisions, unresolved
  escalations.
- Log the cycle: `python3 scripts/cso_store.py summary` writes the week's roll-up.
