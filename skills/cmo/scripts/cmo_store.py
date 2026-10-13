#!/usr/bin/env python3
"""SQLite helpers for the CMO skill.

Usage:
  python3 cmo_store.py init
  python3 cmo_store.py brief  <brief_id> '<brief_json>'
  python3 cmo_store.py status <brief_id> <assigned|drafted|approved|revision|blocked>
  python3 cmo_store.py score  <brief_id> <score> [notes]
  python3 cmo_store.py metric <campaign> <leads|forms|cpl> <value>
  python3 cmo_store.py flag   <campaign> <item> [reason]
  python3 cmo_store.py alert  '<message>' [recipient]
  python3 cmo_store.py summary [<week_iso_monday>]
"""

import json
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

DB_PATH = "/Users/arlindakaloshi/.hubsy/memory/cmo.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS briefs (
  brief_id   TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  objective  TEXT NOT NULL,
  program    TEXT,
  channel    TEXT,
  format     TEXT,
  audience   TEXT,
  owner      TEXT NOT NULL,
  deadline   TEXT,
  pillar     TEXT,
  status     TEXT NOT NULL DEFAULT 'assigned',
  body_json  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  brief_id   TEXT NOT NULL,
  score      REAL NOT NULL,
  notes      TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign    TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS flags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign   TEXT,
  item       TEXT NOT NULL,
  reason     TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  message    TEXT NOT NULL,
  recipient  TEXT NOT NULL DEFAULT 'arlinda',
  created_at TEXT NOT NULL
);
"""

VALID_STATUS = {"assigned", "drafted", "approved", "revision", "blocked"}
VALID_METRIC = {"leads", "forms", "cpl"}


def now():
    return datetime.now(timezone.utc).isoformat()


def connect():
    return sqlite3.connect(DB_PATH)


def cmd_init():
    with connect() as con:
        con.executescript(SCHEMA)
    print("tables ready at", DB_PATH)


def cmd_brief(args):
    brief_id = args[0]
    body = json.loads(args[1])
    with connect() as con:
        con.execute(
            "INSERT OR REPLACE INTO briefs (brief_id, created_at, objective, program, channel,"
            " format, audience, owner, deadline, pillar, status, body_json)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                brief_id,
                body.get("created_at", now()),
                body.get("objective", ""),
                body.get("program"),
                body.get("channel"),
                body.get("format"),
                body.get("audience_segment"),
                body.get("owner", ""),
                body.get("deadline"),
                body.get("pillar"),
                body.get("status", "assigned"),
                json.dumps(body),
            ),
        )
    print("brief stored:", brief_id)


def cmd_status(args):
    brief_id, status = args[0], args[1]
    if status not in VALID_STATUS:
        print(f"invalid status {status!r}; expected one of {sorted(VALID_STATUS)}")
        sys.exit(1)
    with connect() as con:
        cur = con.execute("UPDATE briefs SET status = ? WHERE brief_id = ?", (status, brief_id))
    print("status updated" if cur.rowcount else "no brief with that id")


def cmd_score(args):
    brief_id = args[0]
    score = float(args[1])
    notes = args[2] if len(args) > 2 else None
    with connect() as con:
        con.execute(
            "INSERT INTO scores (brief_id, score, notes, created_at) VALUES (?, ?, ?, ?)",
            (brief_id, score, notes, now()),
        )
        if score < 8:
            con.execute("UPDATE briefs SET status = 'revision' WHERE brief_id = ?", (brief_id,))
    verdict = "pass" if score >= 8 else "revision"
    print(f"score recorded: {score}/10 -> {verdict}")


def cmd_metric(args):
    campaign, metric, value = args[0], args[1], float(args[2])
    if metric not in VALID_METRIC:
        print(f"invalid metric {metric!r}; expected one of {sorted(VALID_METRIC)}")
        sys.exit(1)
    with connect() as con:
        con.execute(
            "INSERT INTO metrics (campaign, metric, value, recorded_at) VALUES (?, ?, ?, ?)",
            (campaign, metric, value, now()),
        )
    print(f"metric recorded: {campaign}.{metric} = {value}")


def cmd_flag(args):
    campaign = args[0]
    item = args[1]
    reason = args[2] if len(args) > 2 else None
    with connect() as con:
        con.execute(
            "INSERT INTO flags (campaign, item, reason, created_at) VALUES (?, ?, ?, ?)",
            (campaign, item, reason, now()),
        )
    print("flag recorded:", item)


def cmd_alert(args):
    message = args[0]
    recipient = args[1] if len(args) > 1 else "arlinda"
    with connect() as con:
        con.execute(
            "INSERT INTO alerts (message, recipient, created_at) VALUES (?, ?, ?)",
            (message, recipient, now()),
        )
    print(f"alert logged for {recipient}")


def week_bounds(week_arg):
    if week_arg:
        start = datetime.fromisoformat(week_arg).date()
    else:
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=today.weekday())
    end = start + timedelta(days=7)
    return start.isoformat(), end.isoformat()


def cmd_summary(args):
    week = args[0] if args else None
    start, end = week_bounds(week)
    with connect() as con:
        briefs = con.execute(
            "SELECT brief_id, owner, status, deadline FROM briefs WHERE created_at >= ? AND created_at < ?"
            " ORDER BY owner, status",
            (start, end),
        ).fetchall()
        metrics = con.execute(
            "SELECT campaign, metric, value FROM metrics WHERE recorded_at >= ? AND recorded_at < ?"
            " ORDER BY campaign, recorded_at",
            (start, end),
        ).fetchall()
        flags = con.execute(
            "SELECT campaign, item, reason FROM flags WHERE created_at >= ? AND created_at < ?",
            (start, end),
        ).fetchall()
        alerts = con.execute(
            "SELECT message, recipient, created_at FROM alerts WHERE created_at >= ? AND created_at < ?",
            (start, end),
        ).fetchall()

    completed = {}
    awaiting = []
    for brief_id, owner, status, deadline in briefs:
        if status == "approved":
            completed.setdefault(owner, []).append(brief_id)
        elif status == "drafted":
            awaiting.append({"brief_id": brief_id, "owner": owner, "deadline": deadline})

    by_campaign = {}
    for campaign, metric, value in metrics:
        by_campaign.setdefault(campaign, {})[metric] = value

    print(json.dumps({
        "week_of": start,
        "generated_at": now(),
        "completed": completed,
        "awaiting_approval": awaiting,
        "metrics": [{"campaign": c, **vals} for c, vals in by_campaign.items()],
        "flags": [{"campaign": c, "item": i, "reason": r} for c, i, r in flags],
        "alerts": [{"message": m, "recipient": rc, "created_at": t} for m, rc, t in alerts],
    }, indent=2, ensure_ascii=False))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    sub = sys.argv[1]
    args = sys.argv[2:]

    if sub == "init":
        cmd_init()
    elif sub == "brief" and len(args) >= 2:
        cmd_brief(args)
    elif sub == "status" and len(args) == 2:
        cmd_status(args)
    elif sub == "score" and len(args) >= 2:
        cmd_score(args)
    elif sub == "metric" and len(args) == 3:
        cmd_metric(args)
    elif sub == "flag" and len(args) >= 2:
        cmd_flag(args)
    elif sub == "alert" and len(args) >= 1:
        cmd_alert(args)
    elif sub == "summary":
        cmd_summary(args)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
