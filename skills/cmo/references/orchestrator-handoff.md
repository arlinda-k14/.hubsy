# Orchestrator Handoff

How the CMO receives work. The orchestrator is the AIOS's central routing brain
(`skills/orchestrator/SKILL.md`); it classifies intent against `config/skills.json` and
dispatches to a worker. For anything marketing-shaped, that worker is `cmo`. The CMO is itself
a router, so this is a **router handing a route to a router** - the interfaces have to line up
or work leaks between the two.

## Position in the tree

```
orchestrator            # global: picks the domain
   -> cmo               # you: picks the marketing sub-agent
      -> sub-agents     # execute the task
```

The orchestrator never executes and never reads payload bodies back. You inherit the same
discipline one level down, scoped to marketing.

## Inbound envelope (orchestrator -> cmo)

The orchestrator dispatches a signed JSON envelope (see
`skills/orchestrator/references/dispatch-payload.md`). The CMO consumes these fields:

```json
{
  "dispatch_id": "uuid",
  "session_id": "uuid",
  "skill": "cmo",
  "sub_skill": "social-media",
  "action": "draft one LinkedIn carousel for the Digital Marketing cohort",
  "task_prompt": "cleaned, parameter-stripped version of the user's request",
  "user_profile": { "name": "...", "role": "...", "business_context": "..." },
  "parameters": { "program": "digital-marketing", "channel": "linkedin", "deadline": "..." },
  "dependencies": [],
  "issued_at": "2026-10-13T07:00:00+01:00"
}
```

The CMO's job on receipt:

1. Treat `task_prompt` + `parameters` as the objective.
2. Trust `sub_skill` only as a hint; re-classify against the routing table in `SKILL.md` and
   score confidence. The orchestrator may be wrong about which marketing sub-agent fits.
3. If a required field for the route is missing, do not guess. Ask one focused question and
   restate understanding (the orchestrator's clarification rules, applied inside marketing).

## Outbound brief (cmo -> sub-agent)

The CMO converts the inbound envelope into a **brief** - the marketing dispatch payload,
schema in `references/brief-schema.md` - and hands it to the owning sub-agent's
`SKILL.md`. The brief carries everything the sub-agent needs so it never re-prompts the user:
objective, program, channel, format, audience segment, owner, deadline, pillar, rubric, and
dependencies.

The CMO records the brief with `scripts/cmo_store.py brief <id> '<json>'`.

## Return path (sub-agent -> cmo)

The sub-agent returns a draft and sets its status (`drafted`, `revision`, `blocked`) in
`memory/cmo.db`. The CMO:

- gates the return against `references/guardrails.md`, the draft-approval gate, and the
  `references/quality-rubric.md` (`>= 8/10`),
- marks `approved` or sends it back to the same sub-agent with notes,
- never edits the draft itself.

## Completion back to the orchestrator

Workers publish `<worker>.<state>` events (e.g. `cmo.completed`) to the event bus. When the
CMO has gated and recorded a completed deliverable for the dispatch, it publishes completion so
the orchestrator can clear the session. The orchestrator watches event names only, never the
payload body - keep it that way.
