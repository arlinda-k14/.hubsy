#!/usr/bin/env python3
"""SQLite helpers for the CSO skill.

Usage:
  python3 cso_store.py init
  python3 cso_store.py brief   <brief_id> '<brief_json>'
  python3 cso_store.py status  <brief_id> <assigned|drafted|approved|revision|blocked>
  python3 cso_store.py score   <brief_id> <score> [notes]
  python3 cso_store.py deal    <deal_id> <program> <stage> [value]
  python3 cso_store.py stage   <deal_id> <stage> [note]
  python3 cso_store.py metric  <campaign> <accepted|calls|offers|won|revenue|cac> <value>
  python3 cso_store.py flag    <campaign> <item> [reason]
  python3 cso_store.py pipeline
  python3 cso_store.py alert   '<message>' [recipient]
  python3 cso_store.py summary [<week_iso_monday>]
"""

import json
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

DB_PATH = "/Users/arlindakaloshi/.hubsy/memory/cso.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS briefs (
  brief_id   TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  objective  TEXT NOT NULL,
  program    TEXT,
  stage      TEXT,
  channel    TEXT,
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

CREATE TABLE IF NOT EXISTS deals (
  deal_id    TEXT PRIMARY KEY,
  program    TEXT,
  stage      TEXT NOT NULL DEFAULT 'new',
  owner      TEXT,
  value      REAL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deal_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id    TEXT NOT NULL,
  from_stage TEXT,
  to_stage   TEXT NOT NULL,
  note       TEXT,
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
VALID_STAGE = {
    "new",
    "contacted",
    "discovery-booked",
    "discovery-held",
    "offer-sent",
    "won",
    "lost",
}
VALID_METRIC = {"accepted", "calls", "offers", "won", "revenue", "cac"}


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
            "INSERT OR REPLACE INTO briefs (brief_id, created_at, objective, program, stage,"
            " channel, audience, owner, deadline, pillar, status, body_json)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                brief_id,
                body.get("created_at", now()),
                body.get("objective", ""),
                body.get("program"),
                body.get("stage"),
                body.get("channel"),
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


def cmd_deal(args):
    deal_id, program, stage = args[0], args[1], args[2]
    value = float(args[3]) if len(args) > 3 else None
    if stage not in VALID_STAGE:
        print(f"invalid stage {stage!r}; expected one of {sorted(VALID_STAGE)}")
        sys.exit(1)
    with connect() as con:
        row = con.execute("SELECT stage FROM deals WHERE deal_id = ?", (deal_id,)).fetchone()
        from_stage = row[0] if row else None
        con.execute(
            "INSERT OR REPLACE INTO deals (deal_id, program, stage, owner, value, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (deal_id, program, stage, None, value, now()),
        )
        con.execute(
            "INSERT INTO deal_events (deal_id, from_stage, to_stage, note, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (deal_id, from_stage, stage, "deal upserted", now()),
        )
    print(f"deal stored: {deal_id} -> {stage}")


def cmd_stage(args):
    deal_id, stage = args[0], args[1]
    note = args[2] if len(args) > 2 else None
    if stage not in VALID_STAGE:
        print(f"invalid stage {stage!r}; expected one of {sorted(VALID_STAGE)}")
        sys.exit(1)
    with connect() as con:
        row = con.execute("SELECT stage FROM deals WHERE deal_id = ?", (deal_id,)).fetchone()
        if not row:
            print("no deal with that id")
            sys.exit(1)
        con.execute(
            "UPDATE deals SET stage = ?, updated_at = ? WHERE deal_id = ?",
            (stage, now(), deal_id),
        )
        con.execute(
            "INSERT INTO deal_events (deal_id, from_stage, to_stage, note, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (deal_id, row[0], stage, note, now()),
        )
    print(f"stage moved: {deal_id} {row[0]} -> {stage}")


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


def cmd_pipeline():
    with connect() as con:
        rows = con.execute(
            "SELECT deal_id, program, stage, owner, value, updated_at FROM deals"
            " ORDER BY stage, updated_at"
        ).fetchall()
    by_stage = {}
    for deal_id, program, stage, owner, value, updated_at in rows:
        by_stage.setdefault(stage, []).append({
            "deal_id": deal_id,
            "program": program,
            "owner": owner,
            "value": value,
            "updated_at": updated_at,
        })
    print(json.dumps({
        "generated_at": now(),
        "total": len(rows),
        "counts": {stage: len(items) for stage, items in by_stage.items()},
        "by_stage": by_stage,
    }, indent=2, ensure_ascii=False))


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
        deals = con.execute("SELECT stage, COUNT(*), COALESCE(SUM(value), 0) FROM deals GROUP BY stage").fetchall()

    completed = {}
    awaiting = []
    for brief_id, owner, status, deadline in briefs:
        if status == "approved":
            completed.setdefault(owner, []).append(brief_id)
        elif status == "drafted":
            awaiting.append({"brief_id": brief_id, "owner": owner, "deadline": deadline})

    def rates(c):
        a, ca, o, w = c.get("accepted"), c.get("calls"), c.get("offers"), c.get("won")
        return {
            "call": round(ca / a, 2) if a and ca is not None else None,
            "offer": round(o / ca, 2) if ca and o is not None else None,
            "close": round(w / o, 2) if o and w is not None else None,
        }

    by_campaign = {}
    for campaign, metric, value in metrics:
        by_campaign.setdefault(campaign, {})[metric] = value

    print(json.dumps({
        "week_of": start,
        "generated_at": now(),
        "completed": completed,
        "awaiting_approval": awaiting,
        "metrics": [{"campaign": c, **vals, "rates": rates(vals)} for c, vals in by_campaign.items()],
        "pipeline": [{"stage": s, "deals": n, "value": v} for s, n, v in deals],
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
    elif sub == "deal" and len(args) >= 3:
        cmd_deal(args)
    elif sub == "stage" and len(args) >= 2:
        cmd_stage(args)
    elif sub == "metric" and len(args) == 3:
        cmd_metric(args)
    elif sub == "flag" and len(args) >= 2:
        cmd_flag(args)
    elif sub == "pipeline":
        cmd_pipeline()
    elif sub == "alert" and len(args) >= 1:
        cmd_alert(args)
    elif sub == "summary":
        cmd_summary(args)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
