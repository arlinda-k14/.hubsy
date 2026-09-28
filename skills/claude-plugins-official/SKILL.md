---
name: claude-plugins-official
description: Interface Hubsy with the official Anthropic Claude Plugins directory (github.com/anthropics/claude-plugins-official). Defines how to install, configure, and drive official Claude Code plugins and their MCP servers for external tools: GitHub (issue/PR/repo management via the GitHub MCP server), Slack (workspace search, channels, threads), Google Workspace (Gmail/Calendar/Drive workflows), Notion (search, pages, databases), and Web Search (Exa/Brave/web MCP). Covers the standard plugin structure (.claude-plugin/plugin.json, .mcp.json, commands/, agents/, skills/), the immutable-name and marketplace + registry conventions, source types (relative, url, git-subdir), MCP server config syntax (http/stdio, env-var token injection), and authentication patterns (GITHUB_PERSONAL_ACCESS_TOKEN, Slack tokens, Notion integration tokens, Google OAuth, API keys). Use when setting up or using any external-tool integration backed by a Claude plugin, wiring MCP servers, or explaining how Claude Code plugins expose tools to an agent.
---

# Claude Plugins Official

You are Hubsy's interface for the **official Anthropic Claude Plugins
directory** (https://github.com/anthropics/claude-plugins-official). This is
Anthropic's curated, first-party marketplace of Claude Code plugins that
package **external tool integrations** (GitHub, Slack, Google Workspace,
Notion, Web Search) behind a standard plugin contract. Plugins wrap MCP
servers, skills, slash commands, and agents into a single installable unit.

Full registry details live in `references/plugin-registry.md`. Load it when
you need concrete plugin names, tool definitions, install commands, or
authentication configuration.

## What the official directory is

A curated directory of high-quality plugins for Claude Code, organized as:

- **`/plugins`** — internal plugins developed and maintained by Anthropic.
- **`/external_plugins`** — third-party plugins from partners and the
  community (the connectors described here).

Trust is the operating rule: Anthropic does not control what MCP servers,
files, or other software plugins include. Verify a plugin before installing,
updating, or using it, especially when it is going to handle credentials.

## Installing official plugins

Plugins are installed through Claude Code's plugin system, either by name
from this marketplace or by browsing:

```
/plugin install {plugin-name}@claude-plugins-official
```

To use a plugin across an org or a specific project, define it under
`settings.json` (`.claude/settings.json` for user/org scope, `.claude`
project scope for project scope) with the marketplace source
`github.com/anthropics/claude-plugins-official`.

## Standard plugin structure

Every compliant plugin follows the same layout:

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json      # Plugin metadata (required; author, name, description)
├── .mcp.json            # MCP server configuration (optional)
├── commands/            # Slash commands (optional)
├── agents/              # Agent definitions (optional)
├── skills/              # Skill definitions (optional)
└── README.md            # Documentation
```

**Name immutability.** The `name` in a marketplace entry is an immutable
slug. Do not rename a published plugin — users have it installed under that
slug and a rename breaks installs with `plugin-not-found`. Update
`displayName` for label changes; for unavoidable renames add a `renames`
map in `.claude-plugin/marketplace.json` so existing installs auto-migrate.

**Skill-bundle plugins.** When a plugin's source repo ships `SKILL.md` files
without a plugin manifest, the marketplace entry can expose them with
`strict: false` and an explicit `skills` array, each path relative to
`source.path` and pointing at a directory containing a `SKILL.md`. Each
skill registers as `<plugin-name>:<skill-name>`.

### Marketplace entry schema

The `marketplace.json` has `$schema`, `name`, `description`, `owner`,
`renames` (migration map), and a large `plugins` array. Each plugin entry:

- `name` (immutable slug) and `description` (what the plugin does).
- `author` (`name`, optional `email`/`url`).
- `category` (e.g. `productivity`, `development`, `security`, `database`,
  `design`, `deployment`, `automation`, `monitoring`).
- `source` — how the plugin is fetched:
  - `"./plugins/name"` or `"./external_plugins/name"` (relative, in-repo),
  - `{ "source": "url", "url": "https://github.com/...git", "sha": "..." }`
    (repo clone at a pinned commit),
  - `{ "source": "git-subdir", "url": "...", "path": "...", "ref": "main",
    "sha": "..." }` (a subdirectory of a repo at a pinned commit).
- `homepage` — where users read about and audit the plugin.
- Optional `strict`, `displayName`, `version`, `tags`, `lspServers`.

## External tool integrations (the connectors)

The directory exposes each of these external tools as a plugin that
configures MCP tools the agent can call. Interface patterns per tool:

### GitHub (repository management)
- Plugin: `github` (official GitHub MCP server; source
  `./external_plugins/github`).
- Capabilities: create issues, manage pull requests, review code, search
  repositories, act on the full GitHub REST/GraphQL API from the agent.
- MCP config (`external_plugins/github/.mcp.json`): HTTP transport to
  `https://api.githubcopilot.com/mcp/` with a Bearer token header:
  ```json
  {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
  ```
- Auth pattern: set `GITHUB_PERSONAL_ACCESS_TOKEN` (from
  github.com/settings/tokens) in the environment; the config injects it via
  `${VAR}` interpolation at runtime.

### Slack (workspace communications)
- Plugin: `slack` (from `slackapi/slack-mcp-plugin`).
- Capabilities: search messages, access channels, read threads, stay
  connected to team communications while working.
- Auth pattern: Slack bot/user token distributed to the MCP server via
  environment variables (the plugin's README defines the exact variable
  names, commonly `SLACK_BOT_TOKEN` and related workspace config).

### Google Workspace (Gmail, Calendar, Drive)
- Plugin: Google Cloud Storage (`google-cloud-storage`, Google LLC) covers
  GCS buckets/objects/transfer. Broad Gmail/Calendar/Drive workflows are
  reached through Google OAuth-based MCP servers and partner connectors
  (the exact workspace plugin is configured via the plugin's README).
- Auth pattern: Google OAuth client credentials plus OAuth consent; tokens
  are scoped to the Gmail/Calendar/Drive APIs the connector needs.

### Notion (knowledge base and databases)
- Plugin: `notion` (from `makenotion/claude-code-notion-plugin`).
- Capabilities: search pages, create and update documents, manage
  databases, access the team's knowledge base.
- Auth pattern: Notion integration token (internal integration secret) with
  capabilities granted to the specific workspace; the connector maps it to
  the Notion API.

### Web Search
- Plugins: `exa` (Exa AI web search, deep research, content extraction) and
  similar web/chrome search connectors; `tavily` (search/extract/crawl APIs).
- Capabilities: comprehensive web search, people/company research, content
  extraction, citations.
- Auth pattern: API keys injected into the MCP server environment (e.g.
  `EXA_API_KEY`, Tavily key) for the search provider.

## Configuring an external-plugin MCP server

The `.mcp.json` maps MCP server names (the keys) to server definitions:

```json
{
  "server-name": {
    "type": "http",
    "url": "https://api.example.com/mcp/",
    "headers": { "Authorization": "Bearer ${YOUR_TOKEN}" }
  }
}
```

or, for a local stdio server, the command/args to launch:

```json
{
  "server-name": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@example/mcp-server"]
  }
}
```

Tokens and keys are passed through `${ENV_VAR}` interpolation from the
environment at runtime — never hardcode credentials in `.mcp.json` or
plugin manifests, and never commit secrets.

## Marketing vs. capability note

A plugin's `description` entry is curated marketing; the ground truth for
capabilities and authentication is the plugin's **README** and its
`.mcp.json`. When using a connector, read the README first to confirm the
exact tool list, scopes, and env-var names before assuming capabilities.

## Workflow for using an external-tool integration

1. **Identify the plugin** in the marketplace (`references/plugin-registry.md`
   or `/plugin > Discover`).
2. **Confirm trust and scope**: read the README, note what it can access and
   what auth it needs.
3. **Install** via `/plugin install {name}@claude-plugins-official` or add to
   the relevant `settings.json`.
4. **Provide credentials** in the environment per the auth pattern
   (env-var token, OAuth, or API key). Never hardcode.
5. **Verify the tools are exposed** (the MCP server tools become callable),
   then drive them for the task.