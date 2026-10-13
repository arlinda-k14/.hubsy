#!/usr/bin/env python3
"""Reconcile the CSO's sub-agent registry from the agents/ folder.

Single source of truth: every sub-agent is a folder `skills/cso/agents/<name>/`
containing a valid `SKILL.md`, plus an optional `agent.json` sidecar with the richer
routing metadata (owns, signals, required_parameters, backing_skills).

This script keeps two derived artifacts in sync with that folder:
  - the `cso` entry's `sub_skills` array in `config/skills.json`
  - `skills/cso/references/routing-table.md`

So a new sales skill is registered under the CSO automatically: drop a folder in
`agents/` and run this. The skill-builder workflow runs it after creating a skill.

The pipeline this serves: the orchestrator routes a sales intent to `cso`, and `cso`
reads the derived routing table to find the best sub-agent for the original user input.

Usage:
  python3 sync_subskills.py            # reconcile config + routing table
  python3 sync_subskills.py --check    # exit 1 if either artifact is out of date
  python3 sync_subskills.py --print    # print the discovered registry as JSON
"""

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSO_DIR = os.path.dirname(SCRIPT_DIR)
SKILLS_DIR = os.path.dirname(CSO_DIR)
REPO_DIR = os.path.dirname(SKILLS_DIR)

AGENTS_DIR = os.path.join(CSO_DIR, "agents")
CONFIG_PATH = os.path.join(REPO_DIR, "config", "skills.json")
ROUTING_TABLE_PATH = os.path.join(CSO_DIR, "references", "routing-table.md")


def parse_frontmatter(path):
    """Return {key: value} for the simple top-level keys in a SKILL.md frontmatter."""
    fields = {}
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    if not text.startswith("---"):
        return fields
    end = text.find("\n---", 3)
    if end == -1:
        return fields
    block = text[3:end]
    for line in block.splitlines():
        if not line.strip():
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()
        if value.startswith(("'", '"')) and value.endswith(("'", '"')) and len(value) >= 2:
            value = value[1:-1]
        if key in ("name", "description"):
            fields[key] = value
    return fields


def discover():
    if not os.path.isdir(AGENTS_DIR):
        return []
    found = []
    for name in sorted(os.listdir(AGENTS_DIR)):
        agent_dir = os.path.join(AGENTS_DIR, name)
        skill_md = os.path.join(agent_dir, "SKILL.md")
        if not os.path.isdir(agent_dir) or not os.path.isfile(skill_md):
            continue
        fm = parse_frontmatter(skill_md)
        sidecar_path = os.path.join(agent_dir, "agent.json")
        meta = {}
        if os.path.isfile(sidecar_path):
            with open(sidecar_path, "r", encoding="utf-8") as fh:
                meta = json.load(fh)
        owns = meta.get("owns") or (fm.get("description", "").split(". ")[0].strip())
        found.append({
            "name": meta.get("name") or fm.get("name") or name,
            "description": fm.get("description", ""),
            "owns": owns,
            "signals": meta.get("signals", []),
            "required_parameters": meta.get("required_parameters", []),
            "backing_skills": meta.get("backing_skills", []),
            "path": "skills/cso/agents/{}/SKILL.md".format(name),
        })
    return found


def ordered(discovered, previous_order):
    """Keep existing display order stable; append new agents alphabetically."""
    by_name = {a["name"]: a for a in discovered}
    order = [n for n in previous_order if n in by_name]
    order += sorted(n for n in by_name if n not in order)
    return [by_name[n] for n in order]


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def current_cso_order(config):
    for entry in config.get("skills", []):
        if entry.get("name") == "cso":
            return [s.get("name") for s in entry.get("sub_skills", [])]
    return []


def build_subskills(agents):
    subs = []
    for a in agents:
        owns = a.get("owns") or ""
        summary = owns[:1].upper() + owns[1:] if owns else a.get("description", "")
        subs.append({
            "name": a["name"],
            "description": summary,
            "path": a["path"],
            "required_parameters": a["required_parameters"],
        })
    return subs


def updated_config(config, subskills):
    out = json.loads(json.dumps(config))
    for entry in out.get("skills", []):
        if entry.get("name") == "cso":
            entry["sub_skills"] = subskills
            break
    return out


def slug(s):
    return s if s else "-"


def render_routing_table(agents):
    lines = [
        "# Sub-Agent Routing Table",
        "",
        "The CSO routes to exactly the sub-agents below and nothing else. The top-level",
        "`config/skills.json` knows `cso` as a single route target; this file is the CSO's",
        "private registry, the sub-orchestrator layer beneath it. Load it before classifying any",
        "intent.",
        "",
        "> Generated by `scripts/sync_subskills.py` from `agents/*/`. Do not edit by hand - edit",
        "> the sub-agent's `SKILL.md` or `agent.json` and re-run the sync.",
        "",
        "## Routing map",
        "",
        "| Route to | Owns | Intent / signal | Required parameters | Backing skills |",
        "| --- | --- | --- | --- | --- |",
    ]
    for a in agents:
        lines.append("| `{}` | {} | {} | {} | {} |".format(
            a["name"],
            slug(a["owns"]),
            slug(", ".join(a["signals"])),
            slug(", ".join("`{}`".format(p) for p in a["required_parameters"])),
            slug(", ".join("`{}`".format(b) for b in a["backing_skills"])),
        ))
    lines += [
        "",
        "## Querying rules",
        "",
        "1. Match on sub-agent name, then `owns`, then intent signal - in that order of confidence lift.",
        "2. Score in [0.00, 1.00]. `>= 0.80` is a direct match; below that enters the clarification loop.",
        "3. A dispatch touching more than one sub-agent must be split into sequential sub-tasks with an",
        "   explicit order and dependency notes (discovery before closing, pipeline before outreach).",
        "4. Never route outside these sub-agents. A non-sales intent goes back to the orchestrator",
        "   for `cmo` or re-routing.",
        "",
        "## Sub-agent contracts",
        "",
        "Each sub-agent's full definition and output contract lives in its own file. Read the target",
        "file before dispatching so the payload matches what the sub-agent can actually produce.",
        "",
    ]
    for a in agents:
        lines.append("- `{}`  ({})".format(a["path"].replace("skills/cso/", ""), a["name"]))
    lines += [
        "",
        "## Adding a sub-agent",
        "",
        "Any new sales skill is created under `skills/cso/agents/<name>/` with a `SKILL.md`",
        "(and an optional `agent.json` sidecar carrying `owns`, `signals`, `required_parameters`,",
        "and `backing_skills`). Then run `scripts/sync_subskills.py`, which auto-registers it here",
        "and in the `cso` record's `sub_skills` inside `config/skills.json`. Registration is derived,",
        "not typed by hand.",
        "",
    ]
    return "\n".join(lines) + "\n"


def write_or_check(path, content, check, label, drift):
    existing = None
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as fh:
            existing = fh.read()
    if check:
        if existing != content:
            drift.append(label)
        return
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)


def main():
    args = sys.argv[1:]
    check = "--check" in args
    do_print = "--print" in args

    config = load_config()
    agents = ordered(discover(), current_cso_order(config))
    subskills = build_subskills(agents)

    if do_print:
        print(json.dumps(agents, indent=2, ensure_ascii=False))
        return

    new_config = updated_config(config, subskills)
    config_text = json.dumps(new_config, indent=2, ensure_ascii=False)
    table_text = render_routing_table(agents)

    drift = []
    write_or_check(CONFIG_PATH, config_text, check, "config/skills.json", drift)
    write_or_check(ROUTING_TABLE_PATH, table_text, check, "routing-table.md", drift)

    if check:
        if drift:
            print("OUT OF DATE:", ", ".join(drift))
            print("run: python3 skills/cso/scripts/sync_subskills.py")
            sys.exit(1)
        print("sub-agent registry in sync ({} agents)".format(len(agents)))
        return

    print("registered {} sub-agents under cso: {}".format(
        len(agents), ", ".join(a["name"] for a in agents)))


if __name__ == "__main__":
    main()
