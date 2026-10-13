# Brief Schema

Every sales objective is decomposed into **briefs**. One brief is one unit of work owned by
exactly one sub-agent. The CSO writes the brief; the sub-agent executes it. The schema below is
the only accepted shape; `scripts/cso_store.py brief` stores it.

## Brief object

```json
{
  "brief_id": "uuid-string",
  "created_at": "2026-10-13T08:00:00+01:00",
  "objective": "one sentence, action-first",
  "program": "digital-marketing | vibe-coding | full-stack | data-science",
  "stage": "pipeline | outreach | discovery | closing | revenue",
  "channel": "email | linkedin | phone | whatsapp | multi",
  "audience_segment": "career-switchers-kosovo | career-switchers-remote | warm-replied | stalled",
  "lead_refs": ["deal_id or lead_ref this brief touches"],
  "owner": "pipeline | outreach | discovery | closing | revenue-analytics",
  "deadline": "2026-10-20",
  "rubric": ["fit and qualification accuracy", "single clear ask", "human on-brand voice"],
  "pillar": "one of the message anchors the piece hangs on",
  "notes": "constraints, sources, or prior context",
  "dependencies": ["brief_id this brief waits on"],
  "status": "assigned | drafted | approved | revision | blocked"
}
```

## Required fields

`objective`, `program`, `stage`, `audience_segment`, `owner`, `deadline`, `rubric`. A brief
missing any required field is not dispatchable - the CSO asks one clarifying question instead
of guessing. `channel` is required for everything except `pipeline` and `revenue` briefs.

## Status lifecycle

```
assigned -> drafted -> approved
                 \-> revision -> drafted
blocked (worker or handoff source unavailable; escalates to the CSO)
```

Only `approved` briefs count toward the weekly summary's completed total. `drafted` items are
listed as awaiting approval.

## SQLite schema (`memory/cso.db`)

Created and maintained by `scripts/cso_store.py`. Do not create tables outside this script.

```sql
CREATE TABLE IF NOT EXISTS briefs (
  brief_id      TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  objective     TEXT NOT NULL,
  program       TEXT,
  stage         TEXT,
  channel       TEXT,
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

CREATE TABLE IF NOT EXISTS deals (
  deal_id       TEXT PRIMARY KEY,
  program       TEXT,
  stage         TEXT NOT NULL DEFAULT 'new',
  owner         TEXT,
  value         REAL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deal_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id       TEXT NOT NULL,
  from_stage    TEXT,
  to_stage      TEXT NOT NULL,
  note          TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign      TEXT NOT NULL,
  metric        TEXT NOT NULL,          -- accepted | calls | offers | won | revenue | cac
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

Why SQLite: it matches `memory/cmo.db` and `memory/orchestrator.db`, has no moving parts on a
personal machine, and the CSO's write volume is trivial. Live planning context stays in the
session; SQLite is for durable briefs, scores, deals, metrics, flags, and alerts.
