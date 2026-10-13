#!/usr/bin/env python3
"""Register (or remove) a CSO sub-agent in the AIOS.

The CSO parent agent routes a dispatched sales intent by reading
``skills/cso/agents/registry.json``. This script is the ONLY supported way to
change that registry, and it keeps the two files the CSO depends on in sync:

  1. ``skills/cso/agents/registry.json``  - the CSO's private routing manifest
  2. ``config/skills.json``               - the AIOS-wide registry; the ``cso``
                                            entry's ``sub_skills`` list

The skill-builder calls this automatically whenever it creates a skill in the
sales domain, so a new sales skill becomes routable without any hand-editing.

Usage
-----
  python3 register_subagent.py add \
      --name proposals \
      --owns "draft and track custom program proposals" \
      --triggers "proposal,draft an offer document" \
      --params "lead_refs,program" \
      --backing "humanizer,google-workspace-cli" \
      [--path agents/proposals/SKILL.md]

  python3 register_subagent.py list
  python3 register_subagent.py remove --name proposals

Run `add` again with the same --name to update an existing sub-agent (upsert).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
CSO_DIR = HERE.parent.parent           # skills/cso
ROOT = CSO_DIR.parent.parent           # repo root (the .hubsy folder)
REGISTRY_PATH = CSO_DIR / "agents" / "registry.json"
SKILLS_JSON = ROOT / "config" / "skills.json"

# config/skills.json is stored with 2-space indent, no trailing newline. Match
# that exactly so a rewrite produces a minimal diff.
SKILLS_INDENT = 2
SKILLS_TRAILING_NEWLINE = False


def _csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [chunk.strip() for chunk in value.split(",") if chunk.strip()]


def load_registry() -> dict:
    if not REGISTRY_PATH.exists():
        return {"parent": "cso", "registry_version": "1.0", "sub_agents": []}
    return json.loads(REGISTRY_PATH.read_text())


def save_registry(registry: dict) -> None:
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n")


def load_skills() -> dict:
    return json.loads(SKILLS_JSON.read_text())


def save_skills(data: dict) -> None:
    text = json.dumps(data, indent=SKILLS_INDENT, ensure_ascii=False)
    if SKILLS_TRAILING_NEWLINE:
        text += "\n"
    SKILLS_JSON.write_text(text)


def find_cso_entry(skills: dict) -> dict:
    for entry in skills.get("skills", []):
        if entry.get("name") == "cso":
            return entry
    raise SystemExit("error: no 'cso' entry in config/skills.json")


def upsert_agent(registry: dict, agent: dict) -> str:
    agents = registry.setdefault("sub_agents", [])
    for i, existing in enumerate(agents):
        if existing.get("name") == agent["name"]:
            agents[i] = agent
            return "updated"
    agents.append(agent)
    return "added"


def upsert_sub_skill(cso_entry: dict, entry: dict) -> str:
    subs = cso_entry.setdefault("sub_skills", [])
    for i, existing in enumerate(subs):
        if existing.get("name") == entry["name"]:
            subs[i] = entry
            return "updated"
    subs.append(entry)
    return "added"


def cmd_add(args: argparse.Namespace) -> None:
    if not args.name:
        raise SystemExit("error: --name is required")
    agent = {
        "name": args.name,
        "path": args.path or f"agents/{args.name}/SKILL.md",
        "owns": args.owns or "",
        "triggers": _csv(args.triggers),
        "required_parameters": _csv(args.params),
        "backing_skills": _csv(args.backing),
    }

    registry = load_registry()
    reg_status = upsert_agent(registry, agent)
    save_registry(registry)

    skills = load_skills()
    cso = find_cso_entry(skills)
    skill_entry = {
        "name": agent["name"],
        "description": agent["owns"],
        "required_parameters": agent["required_parameters"],
    }
    skill_status = upsert_sub_skill(cso, skill_entry)
    save_skills(skills)

    print(f"registry.json: {reg_status} sub-agent '{agent['name']}' -> {agent['path']}")
    print(f"config/skills.json: {skill_status} cso.sub_skills '{agent['name']}'")
    if not (CSO_DIR / agent["path"]).exists():
        print(f"note: {agent['path']} does not exist yet - create the SKILL.md before routing to it")


def cmd_remove(args: argparse.Namespace) -> None:
    if not args.name:
        raise SystemExit("error: --name is required")

    registry = load_registry()
    before = len(registry.get("sub_agents", []))
    registry["sub_agents"] = [a for a in registry.get("sub_agents", []) if a.get("name") != args.name]
    save_registry(registry)
    reg_removed = before - len(registry["sub_agents"])

    skills = load_skills()
    cso = find_cso_entry(skills)
    before_sub = len(cso.get("sub_skills", []))
    cso["sub_skills"] = [s for s in cso.get("sub_skills", []) if s.get("name") != args.name]
    save_skills(skills)
    skill_removed = before_sub - len(cso["sub_skills"])

    print(f"registry.json: removed {reg_removed} entry ('{args.name}')")
    print(f"config/skills.json: removed {skill_removed} cso.sub_skills entry ('{args.name}')")


def cmd_list(args: argparse.Namespace) -> None:
    registry = load_registry()
    agents = registry.get("sub_agents", [])
    if not agents:
        print("no sub-agents registered")
        return
    width = max(len(a.get("name", "")) for a in agents)
    for a in agents:
        print(f"{a.get('name', ''):<{width}}  {a.get('owns', '')}")
        triggers = ", ".join(a.get("triggers", []))
        if triggers:
            print(f"{'':<{width}}  triggers: {triggers}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Register a CSO sub-agent in the AIOS.")
    sub = parser.add_subparsers(dest="command", required=True)

    add = sub.add_parser("add", help="add or update a sub-agent (upsert by name)")
    add.add_argument("--name", required=True)
    add.add_argument("--owns")
    add.add_argument("--triggers")
    add.add_argument("--params")
    add.add_argument("--backing")
    add.add_argument("--path")
    add.set_defaults(func=cmd_add)

    remove = sub.add_parser("remove", help="remove a sub-agent by name")
    remove.add_argument("--name", required=True)
    remove.set_defaults(func=cmd_remove)

    lst = sub.add_parser("list", help="list registered sub-agents")
    lst.set_defaults(func=cmd_list)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
