# Agent Skills Specification — Reference Guide

Summary of the official Agent Skills specification (https://agentskills.io),
as maintained and implemented by anthropics/skills. Source of truth for how
custom skills (including the skills in this repo) are formatted.

## What a skill is

A skill is a directory of instructions, scripts, and resources that an agent
loads dynamically to complete specialized, repeatable tasks. It is a folder
named after the skill that contains a `SKILL.md` file at minimum.

## Directory structure

```
skill-name/
├── SKILL.md          # Required: YAML frontmatter + Markdown instructions
├── scripts/          # Optional: executable code (agent-runnable)
├── references/       # Optional: on-demand documentation
├── assets/           # Optional: templates, images, data files
└── ...               # Any additional files or directories
```

## SKILL.md frontmatter

YAML frontmatter delimited by `---` at the top of the file, followed by a
Markdown body.

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes | ≤64 chars; lowercase letters, digits, and hyphens only; must not start/end with a hyphen; no consecutive hyphens; must match the parent directory name |
| `description` | Yes | ≤1024 chars; non-empty; describes what the skill does and when to use it |
| `license` | No | License name or reference to a bundled license file |
| `compatibility` | No | ≤500 chars; environment requirements (product, packages, network) |
| `metadata` | No | Map of string keys to string values |
| `allowed-tools` | No | Space-separated pre-approved tools (experimental) |

### `name`

- 1-64 characters
- Only `a-z`, `0-9`, and `-`
- No leading/trailing hyphen, no `--`
- Must equal the directory name

Valid: `pdf-processing`, `data-analysis`, `code-review`.
Invalid: `PDF-Processing` (uppercase), `-pdf` (leading hyphen),
`pdf--processing` (consecutive hyphens).

### `description`

- 1-1024 characters
- State **what** it does and **when** to use it
- Embed trigger keywords agents can match against

Good: "Extracts text and tables from PDF files, fills PDF forms, and merges
multiple PDFs. Use when working with PDF documents or when the user mentions
PDFs, forms, or document extraction."
Poor: "Helps with PDFs."

### `license`

Keep short — a license name or a bundled-file reference. Example:
`Proprietary. LICENSE.txt has complete terms`.

### `compatibility`

Only when the skill has real environment requirements. Example: "Requires
Python 3.14+ and uv", or "Requires git, docker, jq, and internet access".
Most skills do not need it.

### `metadata`

Arbitrary string-to-string map for extension properties. Prefix keys to
avoid collisions (`author: example-org`, `version: "1.0"`).

### `allowed-tools`

Experimental. Space-separated pre-approved tools, e.g.
`Bash(git:*) Bash(jq:*) Read`. Support varies across agent implementations.

## Minimal / extended examples

```markdown
---
name: skill-name
description: A description of what this skill does and when to use it.
---
```

```markdown
---
name: pdf-processing
description: Extract PDF text, fill forms, merge files. Use when handling PDFs.
license: Apache-2.0
metadata:
  author: example-org
  version: "1.0"
---
```

## Body content

No format restrictions — the Markdown below the frontmatter is the
instruction set. Recommended sections:

- Step-by-step instructions
- Examples of inputs and outputs
- Common edge cases and failure modes

The agent loads the *entire* body once the skill activates. For long skills,
keep `SKILL.md` focused and move depth into references/ files.

## Optional directories

### `scripts/`

Executable code the agent can run (Python, Bash, JavaScript, …). Scripts
should be self-contained or document dependencies, include helpful error
messages, and handle edge cases.

### `references/`

Additional docs loaded on demand: `REFERENCE.md` (technical reference),
`FORMS.md` (form templates), or domain files (`finance.md`, `legal.md`).
Keep each file focused — agents load them lazily, so smaller files consume
less context.

### `assets/`

Static resources: document/config templates, images/diagrams, lookup tables,
schemas.

## Progressive disclosure

Agents load skill content in layers, so structure skills to match:

1. **Metadata** (~100 tokens): `name` + `description`, loaded at startup for
   every skill.
2. **Instructions** (<5000 tokens recommended): full `SKILL.md` body, loaded
   when the skill activates.
3. **Resources** (as needed): `scripts/`, `references/`, `assets/` files,
   loaded only when required.

Keep `SKILL.md` under ~500 lines; defer the rest to referenced files.

## File references

Use relative paths from the skill root, one level deep from `SKILL.md`:

```markdown
See [the reference guide](references/REFERENCE.md) for details.
Run the extraction script: scripts/extract.py
```

Avoid deeply nested reference chains.

## Validation

Validate frontmatter and naming with the reference library:

```bash
skills-ref validate ./my-skill
```

Checks that the `SKILL.md` frontmatter is valid and follows all naming
conventions.

## Source repository

- Repo: https://github.com/anthropics/skills — example skills (creative,
  technical, enterprise/communications, document), the `spec/` folder, and a
  `template/` skill starter.
- Enterprise/document skills bundled: `pdf`, `docx`, `pptx`, `xlsx`,
  `brand-guidelines`, `internal-comms`, `doc-coauthoring`. The document
  creation skills are source-available (not Apache/OSS) and proprietary.
- Spec home: https://agentskills.io/specification
- Skills in Claude: https://support.claude.com/articles/12512198-creating-custom-skills