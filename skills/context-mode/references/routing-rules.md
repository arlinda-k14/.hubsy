# Context Mode — Routing Rules

Normative reference for context-mode's routing of data-heavy commands and
output filtering. Source: mksglu/context-mode README and configs. The goal is
one invariant: **raw data never enters the context window.** Everything below
serves that invariant.

## 1. Data-heavy command routing

Route commands by their output size and what the model actually needs. The
BeforeTool/PreToolUse matchers hit the tools that can flood context:
`run_shell_command`, `read_file`, `read_many_files`, `grep_search`,
`search_file_content`, `web_fetch`, `activate_skill`.

### Heavy web fetches → `ctx_fetch_and_index`

- Never WebFetch a full page into context.
- `ctx_fetch_and_index` fetches, extracts the relevant portion, and indexes
  it. Only the distilled result reaches the model.
- Repeat reads of the same source should hit the index (`ctx_search`), not
  the network.

### Large file reads → sandboxed execution

- Do NOT `Read` entire large files into context to reason over them.
- Use `ctx_execute` / `ctx_execute_file` / `ctx_batch_execute` to run a
  script that does the reading and prints only the answer.

```
# Before: 47 × Read() = ~700 KB of context
# After:  1 × ctx_execute() = ~3.6 KB
ctx_execute("javascript", `
  const files = fs.readdirSync('src').filter(f => f.endsWith('.ts'));
  files.forEach(f => console.log(f + ': ' + fs.readFileSync('src/'+f,'utf8').split('\n').length + ' lines'));
`);
```

### Repeated file access → `ctx_index` + `ctx_search`

- `ctx_index <file|dir>` adds content to the persistent FTS5 knowledge base.
- `ctx_search <query>` returns BM25-ranked relevant snippets only.
- Index once, search many times — never re-read the same corpus into
  context.

## 2. Output filtering rules

1. **Distill at the source.** Compute/prepare inside a script and print only
   the needed value. Do not cat, dump, or stream full outputs.
2. **Search before read.** Identify exactly which lines/identifiers matter
   (Grep / `ctx_search`) and start from those snippets.
3. **Page and trim.** For unavoidable large output, paginate and read in
   slices; stop as soon as the question is answered.
4. **Aggregate.** Prefer counts, summaries, and samples over full listings
   (`num_steps`, `failures`, unique keys, head/tail).
5. **Escalate only on evidence.** Bring a larger truth (whole file) into
   context only when the distilled result is provably insufficient — and
   annotate why.

## 3. Mandatory vs advisory

| Rule | Enforcement |
|------|-------------|
| Heavy web fetches intercepted | Mandatory (routing rule) |
| Large file reads sandboxed | Mandatory (routing rule) |
| Intent-driven search before read | Mandatory (routing rule) |
| Session events tracked (SQLite + FTS5) | Automatic (hooks) |
| Compact → BM25 resume, not raw replay | Automatic (hooks) |
| Brief output style in final answers | **Not enforced** — see below |

## 4. What routing does NOT do

- **No prose-style enforcement.** Context-mode controls where data goes,
  never how the model writes its final answer. Brevity/completeness/format
  remain the model's or the user's call (AGENTS.md/CLAUDE.md). Aggressive
  brevity prompts measurably degrade coding/reasoning quality.
- **No lecture.** The routing block is about tool choice and data pathing,
  not conversational filler.

## 5. Session continuity mechanics

- Events (`tool.execute.before`/`after`, `chat.message`/UserPromptSubmit,
  compaction) are captured into SQLite, then indexed into FTS5.
- On compaction or session start, only BM25-relevant events are retrieved —
  the model resumes, it does not replay the whole history.
- `--continue` resumes prior session state. Without `--continue`, prior
  session data is deleted — a fresh session is a clean slate.
- Platforms without a SessionStart hook (Cursor, OpenCode/KiloCode) inject
  routing via a rules file (`.cursor/rules/context-mode.mdc`, `AGENTS.md`)
  plus `experimental.chat.system.transform` as a surrogate.

## 6. Tool inventory

| Tool | Purpose |
|------|---------|
| `ctx_execute` | Run sandboxed script, return stdout only |
| `ctx_execute_file` | Enqueue a script file for sandboxed execution |
| `ctx_batch_execute` | Multi-step batch job, compact result |
| `ctx_index` | Index local file/dir into FTS5 |
| `ctx_search` | BM25 search over indexed content |
| `ctx_fetch_and_index` | Fetch + extract + index web content |
| `ctx_stats` | Savings / token analytics |
| `ctx_doctor` | Diagnose hooks, FTS5, runtimes |
| `ctx_upgrade` | Update, rebuild, fix hooks |
| `ctx_purge` | Delete indexed content |
| `ctx_insight` | Open hosted analytics dashboard |

## 7. Licensing note

`context-mode` is ELv2-licensed. This reference documents usage/config; do
not redistribute the server binaries or bundle them into an OSS project.