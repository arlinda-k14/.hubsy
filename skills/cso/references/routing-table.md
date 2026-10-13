# Sub-Agent Routing Table

The CSO routes to exactly the sub-agents listed in `agents/registry.json` and nothing else. The
top-level `config/skills.json` knows `cso` as a single route target; `agents/registry.json` is the
CSO's private, machine-readable registry - the sub-orchestrator layer beneath it. Read it before
classifying any intent.

## Read the registry first

Do not route from memory or from this document. Open `agents/registry.json` and read
`sub_agents[]`. Each entry carries:

| Field | Meaning |
| --- | --- |
| `name` | kebab-case sub-agent id |
| `path` | its SKILL.md - read it before dispatching so the payload matches its contract |
| `owns` | what it owns; match on this first |
| `triggers` | example intents that map to it |
| `required_parameters` | entities the sub-agent needs before it can run |
| `backing_skills` | the registered skills it leans on |

The current registered set (pipeline, outreach, discovery, closing, revenue-analytics) is a
snapshot; the registry is authoritative and grows automatically as new sales skills are built.

## Querying rules

1. Match on sub-agent `name`, then `owns`, then `triggers` - in that order of confidence lift.
2. Score in [0.00, 1.00]. `>= 0.80` is a direct match; below that enters the clarification loop.
3. A dispatch touching more than one stage must be split into sequential sub-tasks with an
   explicit order and dependency notes (discovery before closing, pipeline before outreach).
4. Never route outside the registry. Marketing-shaped work goes back to the orchestrator for
   `cmo`; anything else has no route here.

## Sub-agent contracts

Each sub-agent's full definition and output contract lives in its own file at the `path` given in
the registry. Read the target file before dispatching.

## How sub-agents are added

Never hand-edit the registry or the `cso.sub_skills` list in `config/skills.json`. When the
skill-builder creates a skill in the sales domain, it writes `agents/<name>/SKILL.md` and runs:

```sh
python3 scripts/register_subagent.py add \
  --name <name> \
  --owns "<one line: what it owns>" \
  --triggers "phrase one,phrase two" \
  --params "param_one,param_two" \
  --backing "skill-a,skill-b"
```

That command updates `agents/registry.json` (what you read to route) and the `cso` entry's
`sub_skills` in `config/skills.json`, in one step. Use `register_subagent.py list` to see the
current set and `register_subagent.py remove --name <name>` to retract one. After a change,
re-read the registry to keep the taxonomy coherent.
