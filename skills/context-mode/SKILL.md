---
name: context-mode
description: Context window optimization for Hubsy, powered by the context-mode MCP server (mksglu/context-mode). Keeps raw tool output out of the context window (98% reduction) through mandatory routing rules — intercept heavy web fetches, sandbox large file reads, and use intent-driven search so only distilled results reach context. HTTPS: also tracks every edit, git op, task, error, and decision in SQLite/FTS5 for session continuity across compaction, and follows the "think in code" paradigm (write scripts that print only the answer instead of puling 50 files into context). Use whenever the session is long, the user complains about context/token usage or lost progress, web pages or files are being read raw, a search would do the job, or compaction is near. Trigger keywords: context-mode, ctx, context window, context saving, token usage, session continuity, think in code, ctx_execute, ctx_search.
---

# Context Mode

You enforce context-mode's mandatory routing rules to keep raw data out of
the context window, so Hubsy keeps working on long sessions without burning
tokens or losing the thread. The mechanism is the `context-mode` MCP server
(mksglu/context-mode) — an MCP + hooks system that sandboxes tool output
(~98% reduction: e.g. 315 KB of tool output becomes 5.4 KB), persists session
state in SQLite/FTS5, and routes data-heavy commands through structured
tools instead of dumping content into context.

## Mandatory routing rules

These rules are NOT optional. Raw data — full web pages, entire large files,
complete command output — never enters the context window directly.

### 1. Intercept heavy web fetches

Never pull a full web page into context. When a task needs web content:

- Route the fetch through `ctx_fetch_and_index` — it fetches, extracts the
  relevant parts, and indexes the result so only a distilled summary reaches
  context.
- If the page is already indexed, answer from `ctx_search` instead of
  re-fetching.
- Ask the intent first: what fact is the user actually looking for? Fetch
  for that, not for the whole document.

### 2. Sandbox large file reads

Never read a large file (or 50 small ones) wholesale into context to reason
about it. Instead:

- Use `ctx_execute` / `ctx_execute_file` to run a small script that reads
  the file(s) itself and prints only the computed answer. One script
  replaces dozens of read calls.
- `ctx_batch_execute` for multi-step scripts that process many files and
  emit one compact result.
- For files you will search repeatedly, `ctx_index` them once into the FTS5
  knowledge base and query with `ctx_search`.

Think in code: the model is a code generator, not a data processor. Before:
`47 × Read() = 700 KB` of context. After: `1 × ctx_execute() = 3.6 KB`.

### 3. Intent-driven search

Before reading anything, decide what the user/agent needs and search for
just that:

- Use Grep / `ctx_search` on the indexed knowledge base for the exact lines,
  identifiers, or phrases relevant to the task.
- Return matched snippets, not files.
- If a search returns too much, tighten the query (scoped paths, more
  specific terms) rather than dumping results into context.

## Sandbox + meta tools

| Tool | Role |
|------|------|
| `ctx_execute` | Run a sandboxed script that prints only the result |
| `ctx_execute_file` | Execute a script from an existing file |
| `ctx_batch_execute` | Multi-step sandboxed job over many inputs |
| `ctx_index` | Index a local file/dir into the persistent FTS5 knowledge base |
| `ctx_search` | BM25 search over indexed content, return relevant hits only |
| `ctx_fetch_and_index` | Fetch a web page, extract, index — never raw into context |
| `ctx_stats` | Context savings breakdown (tokens, savings ratio) |
| `ctx_doctor` | Diagnostics: hooks, FTS5, runtimes, versions |
| `ctx_upgrade` | Pull latest, rebuild, fix hooks |
| `ctx_purge` | Delete all indexed content |
| `ctx_insight` | Open the hosted Insight dashboard |

## Session continuity

Every file edit, git operation, task, error, and user decision is tracked in
SQLite. When the conversation compacts, context-mode does not flood the
context back — it indexes events into FTS5 and retrieves only what is
relevant via BM25 search, so Hubsy picks up exactly where it left off:

- Continue an existing session with `--continue` to carry prior state.
- A fresh session without `--continue` deletes previous session data
  immediately — fresh session means a clean slate.

## Output filtering

- Route data-heavy commands through the sandbox tools so their output is
  distilled, not streamed into context.
- Capture command results in scripts (`ctx_execute`) that log/print only the
  needed value; do not cat whole outputs.
- Filter with intent: grep/paginate/aggregate at the command level before it
  reaches the model.

## One thing context-mode does NOT do

Context-mode never dictates how the final answer is written. Brevity,
completeness, formatting are the model's call (or the user's own
AGENTS.md/CLAUDE.md). Aggressive brevity prompts degrade coding/reasoning
benchmarks — the routing block stays focused on *where data goes*, not on
*how the model talks*.

## Scope limits

- License: ELv2 (not MIT/Apache). Distribute only as allowed; this skill is
  for configuration and usage guidance.
- Hooks vs MCP-only: the full plugin registers hooks (PreToolUse,
  PostToolUse, UserPromptSubmit, PreCompact, SessionStart, Stop) for
  automatic enforcement. MCP-only installs provide the tools but no
  automatic nudging — routing rules in this skill cover that gap.
- On platforms without a SessionStart hook (e.g. Cursor, OpenCode), routing
  relies on a rules file (`.mdc` / `AGENTS.md`) plus this skill.

Detailed routing rules for data-heavy commands and output filtering live in
`references/routing-rules.md` — treat it as normative.