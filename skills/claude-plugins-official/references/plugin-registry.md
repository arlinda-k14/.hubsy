# Claude Plugins Official: Plugin Registry

Reference for the official Anthropic Claude Plugins directory
(github.com/anthropics/claude-plugins-official). The directory curates 314+
plugin marketplace entries across `plugins/` (Anthropic internal) and
`external_plugins/` (partner and community). This file summarizes the core
official plugins for external tools, their tool definitions, and their
authentication patterns.

## Structure of the repository and marketplace

```
repo root
├── .claude-plugin/marketplace.json   # the marketplace manifest (314+ entries)
├── plugins/                          # internal Anthropic plugins
├── external_plugins/                 # partner/community connectors
└── README.md                         # directory + contribution docs
```

Marketplace entry keys: `$schema`, `name`, `description`, `owner`,
`renames` (immutable-slug migration map), `plugins` (the array).

### Marketplace entry fields

| Field | Purpose |
|---|---|
| `name` | Immutable slug. Renaming breaks installs (`plugin-not-found`). |
| `displayName` | Changeable UI label. |
| `description` | Curated capability summary. |
| `author` | `name`, optional `email`/`url`. |
| `category` | productivity, development, security, database, design, deployment, automation, monitoring. |
| `source` | Fetch mechanism (relative, url, git-subdir). |
| `homepage` | Where users audit the plugin. |
| `strict` | `false` for skill-bundle plugins with explicit `skills` array. |
| `renames` | Old-name → new-name map, auto-migrates installs on sync. |

Source types:

```jsonc
// in-repo relative
{ "name": "github" }  // + "./external_plugins/github"
// pinned full repo
{ "source": "url", "url": "https://github.com/org/repo.git", "sha": "<sha>" }
// pinned subdirectory of a repo
{ "source": "git-subdir", "url": "https://github.com/org/repo.git",
  "path": "plugins/name", "ref": "main", "sha": "<sha>" }
```

## Standard plugin layout

```
plugin-name/
├── .claude-plugin/plugin.json   # required metadata (name, description, author)
├── .mcp.json                    # optional MCP server config
├── commands/                    # optional slash commands
├── agents/                      # optional agent definitions
├── skills/                      # optional skill definitions
└── README.md                    # documentation (ground truth for capability/auth)
```

Skill-bundle plugins (no manifest in source repo) expose skills via
`strict: false` + `skills` array; each registers as
`<plugin-name>:<skill-name>`.

## Core external-tool plugins

### GitHub
- **Marketplace name:** `github`
- **Source:** `./external_plugins/github`
- **Author:** GitHub
- **Homepage:** anthropics/claude-plugins-public `external_plugins/github`
- **Capabilities / tool definitions:** create issues; manage pull requests;
  review code; search repositories; full GitHub API from the agent.
- **MCP server config (`.mcp.json`):**
  ```json
  {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}" }
    }
  }
  ```
- **Authentication:** personal access token from
  github.com/settings/tokens, exported as `GITHUB_PERSONAL_ACCESS_TOKEN`;
  injected at runtime via `${...}` interpolation.

### Slack
- **Marketplace name:** `slack`
- **Source:** `https://github.com/slackapi/slack-mcp-plugin.git`
- **Category:** productivity
- **Capabilities:** search messages; access channels; read threads; stay
  connected to team communications.
- **Authentication:** Slack OAuth bot token distributed to the MCP server
  through environment variables (variable names defined in the plugin's
  README, e.g. `SLACK_BOT_TOKEN`).

### Google Workspace
- **Google Cloud Storage:** `google-cloud-storage` (Google LLC) — GCS
  buckets, objects, transfer; MCP, FUSE, IAM, lifecycle rules, signed URLs,
  Terraform, CLI.
- **Gmail / Calendar / Drive workflows:** reached via Google OAuth-based
  MCP servers and partner connectors; scope decided by the connector's
  README.
- **Authentication:** Google OAuth client credentials + consent scopes for
  the specific APIs (Gmail, Calendar, Drive).

### Notion
- **Marketplace name:** `notion`
- **Source:** `https://github.com/makenotion/claude-code-notion-plugin.git`
- **Capabilities:** search pages; create/update documents; manage databases;
  access the team knowledge base.
- **Authentication:** Notion integration token (internal integration secret)
  with capabilities granted to the target workspace.

### Web Search
- **Exa:** `exa` — web search, deep research, content extraction; people and
  company research; academic papers. MCP tools + research skills. Auth:
  `EXA_API_KEY` (or provider key) in the MCP server environment.
- **Tavily:** `tavily` — search, extract, crawl, research APIs for building
  AI applications with real-time web data. Auth: Tavily API key.

## MCP server config patterns

`.mcp.json` keys are MCP server names; values are server definitions.

```jsonc
// HTTP (remote) server
{ "my-server": {
    "type": "http",
    "url": "https://api.example.com/mcp/",
    "headers": { "Authorization": "Bearer ${TOKEN}" }
} }

// stdio (local) server
{ "my-server": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@example/mcp-server"],
    "env": { "VAR": "${ENV_VAR}" }
} }
```

**Secrets rule:** pass tokens/keys via `${ENV_VAR}` interpolation from the
environment at runtime. Never hardcode credentials in manifests or commit
them.

## Authentication patterns (summary)

| Plugin | Pattern | Key variables |
|---|---|---|
| github | GitHub PAT, Bearer header | `GITHUB_PERSONAL_ACCESS_TOKEN` |
| slack | Slack OAuth bot token → env | `SLACK_BOT_TOKEN` + workspace vars |
| google-cloud-storage | Google OAuth / ADC | Google application credentials |
| google workspace | OAuth client + consent scopes | client id/secret, refresh token |
| notion | Integration token, workspace-granted | Notion integration token |
| exa | Provider API key | `EXA_API_KEY` |

## Usage notes

- Install: `/plugin install {name}@claude-plugins-official`, or add the
  marketplace source to `.claude/settings.json` (user/org) or project scope.
- Trust before install: Anthropic does not control bundled MCP servers/files;
  read the README and homepage before wiring credentials.
- Descriptions are curated copy; the README + `.mcp.json` are ground truth
  for the exact tool list, scopes, and env-var names.
- `renames` map auto-migrates installs if a slug ever changes.