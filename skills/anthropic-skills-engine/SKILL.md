---
name: anthropic-skills-engine
description: Author, structure, and consume skills according to the official Agent Skills Specification (agentskills.io) as implemented by anthropics/skills. Skills are folders with a SKILL.md file combining YAML frontmatter (name, description, optional license/compatibility/metadata) with a Markdown instruction body, organized for progressive disclosure across scripts/, references/, and assets/. Also leverage Anthropic's enterprise skills — PDF/document processing (pdf, docx, pptx, xlsx) and brand-guidelines — for document work and on-brand output. Use whenever the user wants to build a new custom skill for their agent, validate/format a SKILL.md, understand the Agent Skills spec, process or generate documents (PDF/DOCX/PPTX/XLSX), or apply brand guidelines/colors/typography to artifacts. Trigger keywords: agent skills spec, agentskills, SKILL.md, frontmatter, custom skill, skill-creator, document skills, pdf skill, docx, brand guidelines, brand colors, vignette.
---

# Anthropic Skills Engine

You are Hubsy's engine for authoring and using **Agent Skills**, per the
official specification (https://agentskills.io) maintained by
anthropics/skills (https://github.com/anthropics/skills). You both *format
custom skills correctly* and *operate enterprise skills* for documents and
branded output.

## What a skill is

A skill is a folder that teaches an agent how to complete a task in a
repeatable way. It is loaded dynamically: only metadata at startup, the
instructions when the task activates the skill, and supporting files only
when needed (**progressive disclosure**). A skill is not a one-off prompt —
it is a durable, versionable, reusable asset.

## Formatting skills to spec

The spec is deliberately minimal: a directory containing, at minimum, a
`SKILL.md` file.

```
skill-name/
├── SKILL.md          # required: YAML frontmatter + Markdown body
├── scripts/          # optional: executable code (python, bash, js)
├── references/       # optional: on-demand documentation
├── assets/           # optional: templates, images, data files
└── ...
```

### YAML frontmatter

Required fields:

- **`name`** — ≤64 chars, lowercase letters/numbers/hyphens only. Must not
  start/end with a hyphen, no consecutive hyphens, and must match the parent
  directory name.
- **`description`** — ≤1024 chars, non-empty. Names what the skill does AND
  when to use it, with keywords the agent can trigger on. "Extracts text and
  tables from PDFs, fills forms, merges files. Use when working with PDFs,"
  is good; "Helps with PDFs" is not.

Optional fields:

- **`license`** — license name or a reference to a bundled license file
  (e.g. `license: Apache-2.0`, or `Proprietary. LICENSE.txt has complete terms`).
- **`compatibility`** — ≤500 chars, environment requirements (product,
  packages, network). Include only when genuinely needed.
- **`metadata`** — map of string keys to string values for extra attributes.
- **`allowed-tools`** — experimental; a space-separated list of pre-approved
  tools (e.g. `Bash(git:*) Read`).

```markdown
---
name: pdf-processing
description: Extract text and tables from PDFs, fill forms, merge files. Use when handling PDFs.
license: Apache-2.0
metadata:
  author: example-org
  version: "1.0"
---
```

### Markdown body

The body after the frontmatter is the instruction set — no format
restrictions. Recommended: step-by-step instructions, worked input/output
examples, and common edge cases. The agent loads the **entire** body when it
activates the skill, so:

- Keep `SKILL.md` under ~500 lines / ~5000 tokens.
- Push depth into `references/` files and pull them only as needed.
- Reference files one level deep from the skill root
  (`references/REFERENCE.md`, never deeper chains).

### Validation

Validate before shipping: `skills-ref validate ./my-skill` (from the
agentskills reference library) checks frontmatter validity and naming rules.

## Enterprise skills you may operate

The anthropics/skills repo bundles skills that power document creation and
branded output. These are reference implementations; test before relying on
them for critical work.

### Document processing

- **pdf** — read/extract text and tables, merge, split, rotate, watermark,
  create, fill forms, encrypt/decrypt, extract images, and OCR scanned PDFs.
  Libraries: `pypdf`, `pdfplumber`, `reportlab`, `pytesseract`; CLIs:
  `pdftotext`, `qpdf`, `pdftk`, `pdfimages`. Source-available, not open
  source (proprietary license terms).
- **docx** — Word document creation and editing (tables, styling, forms).
- **pptx** — PowerPoint generation and editing (slides, shapes, theming).
- **xlsx** — Excel/Spreadsheet workbooks (cells, ranges, formatting).
- **doc-coauthoring** — co-write and edit long documents with the agent.

### Brand guidelines

- **brand-guidelines** — applies official brand colors and typography
  (e.g. Anthropic's palette: Dark `#141413`, Light `#faf9f5`, accent Orange
  `#d97757`, Blue `#6a9bcc`, Green `#788c5d`; headings Poppins, body Lora,
  Arial/Georgia fallbacks) to artifacts. Use when the user wants on-brand
  visuals, color application, or corporate styling.
- **internal-comms** — enterprise communications patterns.

## Workflow for authoring a new skill

1. **Ask or infer the task contract** — what should the skill do, and when
   should it trigger? This becomes the `description`.
2. **Propose a name** — lowercase-hyphen, ≤64 chars, directory-matching.
3. **Write `SKILL.md`** — spec-compliant frontmatter, then a focused Markdown
   body: steps, examples, edge cases. Split heavy detail into `references/`.
4. **Add resources** — `scripts/` for runnable code, `assets/` for
   templates/data, referenced one level deep.
5. **Validate** — `skills-ref validate .` and sanity-check the description
   triggers against real user phrasings.
6. **Register** the skill in `config/skills.json` per the repo registry
   schema so the orchestrator can route to it.

The full spec reference — frontmatter rules, body guidance, optional
directories, progressive disclosure, and validation — is in
`references/spec-guide.md`. Read it before authoring or validating any skill.