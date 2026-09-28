---
name: google-workspace-cli
description: Use the gws CLI (googleworkspace/cli) to interact with Google Workspace APIs from the terminal — Gmail, Calendar, Drive, Sheets, Docs, Chat, and more. Every command returns structured JSON, and the full command surface is built dynamically from Google's Discovery Service. Use whenever Hubsy needs to read or modify the user's Google Workspace data — check or send email, manage calendar events, list or upload Drive files, read/write spreadsheet cells, edit documents, or send Chat messages. Trigger on phrases like 'check my email', 'send an email', 'what's on my calendar', 'add an event', 'list my drive files', 'upload this file', 'read this spreadsheet', 'append a row', 'edit this doc', 'gmail', 'gws'. Even if the user never says 'gws', prefer this skill for any Google Workspace data task over hand-written REST/curl calls.
---

# Google Workspace CLI (gws)

Hubsy drives Google Workspace through the `gws` CLI
(https://github.com/googleworkspace/cli) — one command-line tool for Drive,
Gmail, Calendar, Sheets, Docs, Chat, Admin, and the rest of the Workspace
APIs. Built for humans and AI agents: zero boilerplate, structured JSON
output, and no hand-built REST plumbing.

Two properties shape how you use it:

1. **No static command list.** `gws` downloads Google's own Discovery
   Service documents at runtime and builds its command tree from them. When
   Google adds an endpoint, `gws` picks it up automatically. When in doubt,
   run `gws <service> --help` or `gws schema <method>` to learn the exact
   surface rather than guessing.
2. **Everything is JSON.** Success, error, and metadata output are all
   structured JSON, so results pipe directly into Hubsy's reasoning.

> Not an officially supported Google product (Apache-2.0, active development
> toward v1.0 — expect breaking changes).

## Setup

**Requirements:** Node.js 18+ (for npm install) or a pre-built binary, plus a
Google Cloud project with OAuth credentials.

```bash
# Install (choose one)
npm install -g @googleworkspace/cli     # download the right binary for your OS
brew install googleworkspace-cli        # macOS/Linux
# or download a pre-built binary from GitHub Releases

# One-time auth (fastest path; requires gcloud)
gws auth setup

# Subsequent login with scope selection
gws auth login -s drive,gmail,sheets     # testing-mode apps cap at ~25 scopes
```

Alternatives for agent/headless use:

- **Service account:** `export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/service-account.json`
- **Pre-obtained token:** `export GOOGLE_WORKSPACE_CLI_TOKEN=$(gcloud auth print-access-token)`
- **CI export:** after an interactive login, `gws auth export --unmasked > credentials.json` and set `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` on the target machine.

Auth precedence: `GOOGLE_WORKSPACE_CLI_TOKEN` > `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` > encrypted `gws auth login` creds > `~/.config/gws/credentials.json`.

## Command shape

Discovery-generated calls follow `gws <service> <resource> buckets <method>`:

```bash
gws drive files list --params '{"pageSize": 10}'          # list files
gws sheets spreadsheets create --json '{"properties": {"title": "Q1 Budget"}}'  # create a spreadsheet
gws schema drive.files.list                               # introspect request/response schemas
```

- `--params '{"...": "..."}'` — path/query params (e.g. ids, filters, page size)
- `--json '{"...": "..."}'` — request body for methods that take one
- `--dry-run` — preview the request without executing
- `--page-all` — auto-paginate, one JSON line per page (NDJSON); `--page-limit <N>` (default 10), `--page-delay <MS>` (default 100)
- `--upload ./file` — multipart upload (e.g. `gws drive files create --json '{...}' --upload ./report.pdf`)
- `--sanitize "projects/P/locations/L/templates/T"` — scan a response with Google Cloud Model Armor

## Helper commands (`+`)

Alongside the Discovery surface, some services ship hand-crafted helper
commands prefixed with `+` (never collide with generated methods). Run
`gws <service> --help` to see them.

| Service | Command | Description |
|---------|---------|-------------|
| gmail | `+send` | Send an email |
| gmail | `+reply` | Reply to a message (threads automatically) |
| gmail | `+reply-all` | Reply-all to a message |
| gmail | `+forward` | Forward a message |
| gmail | `+triage` | Unread inbox summary (sender, subject, date) |
| gmail | `+watch` | Watch for new emails, stream as NDJSON |
| sheets | `+append` | Append a row to a spreadsheet |
| sheets | `+read` | Read values from a spreadsheet |
| docs | `+write` | Append text to a document |
| drive | `+upload` | Upload a file with automatic metadata |
| calendar | `+insert` | Create a new event |
| calendar | `+agenda` | Show upcoming events (account timezone; override `--timezone`, `--tz`) |
| workflow | `+standup-report` | Today's meetings + open tasks standup summary |
| workflow | `+meeting-prep` | Next meeting: agenda, attendees, linked docs |
| workflow | `+weekly-digest` | This week's meetings + unread email count |
| workflow | `+email-to-task` | Gmail message → Google Tasks entry |
| workflow | `+file-announce` | Announce a Drive file in a Chat space |

## Safe usage guidelines

- **Prefer helpers for common tasks.** `gws gmail +send --to X --subject Y --body Z` beats composing raw `users.messages.send` JSON by hand.
- **Sheets ranges contain `!`** which bash treats as history expansion — always wrap ranges in **single quotes**: `'Sheet1!A1:C10'`.
- **Read before asserting.** Users' Workspace data is private — confirm a read-only call first (`+triage`, `files list --params '{"pageSize": 5}'`) before any write.
- **Never guess requests.** If unsure of a method's params or body, use `gws <service> --help` and `gws schema <service>.<resource>.<method>` first.
- **Watch exit codes.** `0` success, `1` API error, `2` auth error, `3` validation error, `4` discovery (schema fetch) error, `5` internal error. Branch on these instead of parsing stderr.
- **Do not log credentials.** OAuth tokens and client secrets must never be echoed or written to files beyond gws's own encrypted storage.

## Common pitfalls

- **"Access blocked" / 403 at login** — OAuth app is in testing mode and your
  account is not a Test user. Add your email under OAuth consent screen →
  Test users.
- **"Google hasn't verified this app"** — expected in testing mode; click
  Advanced → Go to app (unsafe). Fine for personal use.
- **Too many scopes** — unverified apps cap at ~25; log in with only the
  services you need (`-s drive,gmail,calendar`).
- **`redirect_uri_mismatch`** — the OAuth client wasn't created as a Desktop
  app; recreate it as type Desktop app.
- **`accessNotConfigured`** — a Workspace API is not enabled in the project;
  click the `enable_url` from the JSON error, or run `gws auth setup`.

The command reference for Gmail, Calendar, and Sheets lives in
`references/gws-commands.md` — read it before driving those services.