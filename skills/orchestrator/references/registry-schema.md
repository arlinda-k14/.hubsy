# Registry Schema

The skill registry lives in `config/skills.json`. It is the single source of truth for what the orchestrator may route to. Never dispatch to a skill that is not registered here.

## Top-level shape

```json
{
  "skills": [ ... RegisteredSkill ... ]
}
```

## RegisteredSkill

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | yes | kebab-case identifier, e.g. `content-drafting`. |
| `description` | string | yes | What the worker skill does. Anchors the orchestrator's confidence scoring. |
| `path` | string | yes | Where the worker skill lives (relative to `.hubsy/`). |
| `domains` | string[] | yes | Domain tags the skill belongs to. Routing must stay within one domain tree. |
| `triggers` | string[] | yes | Example user phrases / contexts that should map to this skill. Helps the classifier recognize intent. |
| `required_parameters` | string[] | no | Entities the downstream worker needs. The dispatcher must extract these into the payload or the route is not ready. |
| `sub_skills` | object[] | no | Sub-skills offered by the worker. Each: `{"name": string, "description": string, "required_parameters": string[]}`. |

## Seeded core domains (initial registry)

### content-drafting
- **sub-skills:** social-copy (platform, tone, length), campaign-text (channel, audience, goal)
- **required_parameters:** tone, audience
- **triggers:** "write a post for", "draft copy", "create a campaign", "social media text", "ad copy"

### web-development
- **sub-skills:** frontend-layout (structure, style), script-logic (behavior, error handling)
- **required_parameters:** deliverable_type, stack
- **triggers:** "build a page", "fix the layout", "add a script", "front-end", "web dev"

### task-scheduling
- **sub-skills:** calendar-management (calendar, timeslot), reminders (delay, channel)
- **required_parameters:** action, time_or_window
- **triggers:** "schedule", "remind me", "book a calendar slot", "set an appointment", "plan my week"

## Querying rules

1. Match on name, then description, then triggers -- in that order of confidence lift.
2. Score in [0.00, 1.00]. >= 0.80 is a direct match; below that enters the clarification loop.
3. A prompt touching more than one domain must be split into sequential sub-tasks with an explicit order and dependency notes; do not choose a single bucket arbitrarily.
4. Never mutate this file outside the skill-builder's create/update workflow.

## Adding a skill

Only skill-builder's workflow may register new entries. When asked to register, produce the entry (and a matching `skills/<name>/SKILL.md`) then re-read this file to keep taxonomy coherent.