# gws Command Reference — Gmail, Calendar, Sheets

Common `gws` commands for the three most-used services. The CLI builds its
command tree at runtime from Google's Discovery Service (cached 24h), so run
`gws <service> --help` and `gws schema <method>` as the source of truth for
the exact current surface.

Shared conventions across all three:

- `--params '{"k": "v"}'` for path/query parameters (always JSON in a shell
  string; single quotes).
- `--json '{"k": "v"}'` for request bodies.
- `--dry-run` to preview, `--page-all`/`--page-limit N`/`--page-delay MS`
  for pagination (NDJSON output).
- Output is always structured JSON.

## Gmail

List messages (default user `me`):

```bash
gws gmail users messages list --params '{"userId": "me", "maxResults": 10}'
gws gmail users messages list --params '{"userId": "me", "q": "from:boss is:unread", "maxResults": 5}'
```

Get a message (use `format` to trim payload):

```bash
gws gmail users messages get --params '{"userId": "me", "id": "MESSAGE_ID", "format": "metadata"}'
```

Helpers (`gws gmail --help` shows the full list):

```bash
# Send
gws gmail +send --to alice@example.com --subject "Hello" --body "Hi there"

# Reply / reply-all / forward (threading handled automatically)
gws gmail +reply --message-id MESSAGE_ID --body "Thanks!"
gws gmail +reply-all --message-id MESSAGE_ID --body "Thanks all!"
gws gmail +forward --message-id MESSAGE_ID --to bob@example.com

# Unread inbox summary (sender, subject, date)
gws gmail +triage

# Stream new emails as NDJSON
gws gmail +watch
```

## Calendar

List events on the primary calendar:

```bash
gws calendar events list --params '{"calendarId": "primary", "maxResults": 10}'
gws calendar events list --params \
  '{"calendarId": "primary", "timeMin": "2026-09-28T00:00:00Z", "timeMax": "2026-10-01T00:00:00Z", "orderBy": "startTime"}'
```

Create an event (request body via `--json`):

```bash
gws calendar events insert \
  --params '{"calendarId": "primary"}' \
  --json '{
    "summary": "Project sync",
    "description": "Weekly sync",
    "start": {"dateTime": "2026-09-29T10:00:00", "timeZone": "Europe/Belgrade"},
    "end":   {"dateTime": "2026-09-29T10:30:00", "timeZone": "Europe/Belgrade"}
  }'
```

Helpers:

```bash
# Upcoming events (uses the Google account timezone by default)
gws calendar +agenda

# Today's agenda in an explicit timezone
gws calendar +agenda --today --timezone America/New_York

# Create a new event
gws calendar +insert
```

## Sheets

Create a spreadsheet:

```bash
gws sheets spreadsheets create --json '{"properties": {"title": "Q1 Budget"}}'
```

Read cells — ranges contain `!`, so always use **single quotes** (bash
history expansion otherwise):

```bash
gws sheets spreadsheets values get \
  --params '{"spreadsheetId": "SPREADSHEET_ID", "range": "Sheet1!A1:C10"}'
```

Append rows (`USER_ENTERED` parses values like a spreadsheet entry):

```bash
gws sheets spreadsheets values append \
  --params '{"spreadsheetId": "SPREADSHEET_ID", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Name", "Score"], ["Alice", 95]]}'
```

Write values to an exact range:

```bash
gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "SPREADSHEET_ID", "range": "Sheet1!B2", "valueInputOption": "RAW"}' \
  --json '{"values": [["42"]]}'
```

Helpers:

```bash
# Append a row (values is a comma-separated string)
gws sheets +append --spreadsheet SPREADSHEET_ID --values "Alice,95"

# Read values from a spreadsheet
gws sheets +read --spreadsheet SPREADSHEET_ID
```

## Cross-service workflow helpers

```bash
gws workflow +standup-report      # today's meetings + open tasks
gws workflow +meeting-prep        # next meeting: agenda, attendees, linked docs
gws workflow +email-to-task       # Gmail message → Google Tasks
gws workflow +weekly-digest       # this week's meetings + unread email count
gws workflow +file-announce       # announce a Drive file in a Chat space
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | API error (Google 4xx/5xx) |
| 2 | Auth error (missing/expired/invalid credentials) |
| 3 | Validation error (bad args, unknown service/flag) |
| 4 | Discovery error (could not fetch API schema) |
| 5 | Internal error |

## Auth for scripts

```bash
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/service-account.json
export GOOGLE_WORKSPACE_CLI_TOKEN=$(gcloud auth print-access-token)   # overrides credentials file
```