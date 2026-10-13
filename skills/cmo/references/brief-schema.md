# Brief Schema

Every campaign is decomposed into **briefs**. One brief is one unit of work owned by exactly
one sub-agent. The CMO writes the brief; the sub-agent executes it. The schema below is the
only accepted shape; `scripts/cmo_store.py brief` validates it.

## Brief object

```json
{
  "brief_id": "uuid-string",
  "created_at": "2026-10-13T07:00:00+01:00",
  "objective": "one sentence, action-first",
  "program": "digital-marketing | vibe-coding | full-stack | data-science",
  "channel": "linkedin | instagram | email | multi",
  "format": "carousel | post | thread | story | calendar | leads | metrics",
  "audience_segment": "career-switchers-kosovo | career-switchers-remote | workshop-attendees",
  "owner": "content-strategy | social-media | lead-generation | analytics",
  "deadline": "2026-10-20",
  "rubric": ["clear hook", "concise educational points", "single direct CTA"],
  "pillar": "one of the message anchors the piece hangs on",
  "notes": "constraints, sources, or prior context",
  "dependencies": ["brief_id this brief waits on"],
  "status": "assigned | drafted | approved | revision | blocked"
}
```

## Required fields

`objective`, `program`, `channel`, `audience_segment`, `owner`, `deadline`, `rubric`.
A brief missing any required field is not dispatchable - the CMO asks one clarifying question
instead of guessing.

## Status lifecycle

```
assigned -> drafted -> approved
                 \-> revision -> drafted
blocked (worker or source unavailable; escalates to the CMO)
```

Only `approved` briefs count toward the weekly summary's completed total. `drafted` items are
listed as awaiting approval.

## SQLite schema (`memory/cmo.db`)

Created and maintained by `scripts/cmo_store.py`. Do not create tables outside this script.

```sql
CREATE TABLE IF NOT EXISTS briefs (
  brief_id      TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  objective     TEXT NOT NULL,
  program       TEXT,
  channel       TEXT,
  format        TEXT,
  audience      TEXT,
  owner         TEXT NOT NULL,
  deadline      TEXT,
  pillar        TEXT,
  status        TEXT NOT NULL DEFAULT 'assigned',
  body_json     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  brief_id      TEXT NOT NULL,
  score         REAL NOT NULL,
  notes         TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign      TEXT NOT NULL,
  metric        TEXT NOT NULL,          -- leads | forms | cpl
  value         REAL NOT NULL,
  recorded_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS flags (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign      TEXT,
  item          TEXT NOT NULL,
  reason        TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  message       TEXT NOT NULL,
  recipient     TEXT NOT NULL DEFAULT 'arlinda',
  created_at    TEXT NOT NULL
);
```

Why SQLite: it matches `memory/orchestrator.db`, has no moving parts on a personal machine,
and the CMO's write volume is trivial. Live planning context stays in the session; SQLite is
for durable briefs, scores, metrics, flags, and alerts.
