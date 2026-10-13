#!/usr/bin/env python3
"""Shared SQLite store for the CSO's sales sub-agents (pipeline, closing,
revenue-analytics). Holds business data only - deals and metrics.

The CSO parent agent keeps its own separate route ledger in ``cso_store.py``
(``memory/cso.db``). This script never touches routing state.

Usage:
  python3 sales_store.py init
  python3 sales_store.py deal    <deal_id> <program> <stage> [value]
  python3 sales_store.py stage   <deal_id> <stage> [note]
  python3 sales_store.py metric  <campaign|program> <accepted|calls|offers|won|revenue|cac> <value>
  python3 sales_store.py flag    <campaign> <item> [reason]
  python3 sales_store.py pipeline
  python3 sales_store.py summary [<week_iso_monday>]
"""

import json
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

DB_PATH = "/Users/arlindakaloshi/.hubsy/memory/cso_sales.db"

SCHEMA = """
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
"""

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
        metrics = con.execute(
            "SELECT campaign, metric, value FROM metrics WHERE recorded_at >= ? AND recorded_at < ?"
            " ORDER BY campaign, recorded_at",
            (start, end),
        ).fetchall()
        flags = con.execute(
            "SELECT campaign, item, reason FROM flags WHERE created_at >= ? AND created_at < ?",
            (start, end),
        ).fetchall()
        deals = con.execute("SELECT stage, COUNT(*), COALESCE(SUM(value), 0) FROM deals GROUP BY stage").fetchall()

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
        "metrics": [{"campaign": c, **vals, "rates": rates(vals)} for c, vals in by_campaign.items()],
        "pipeline": [{"stage": s, "deals": n, "value": v} for s, n, v in deals],
        "flags": [{"campaign": c, "item": i, "reason": r} for c, i, r in flags],
    }, indent=2, ensure_ascii=False))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    sub = sys.argv[1]
    args = sys.argv[2:]

    if sub == "init":
        cmd_init()
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
    elif sub == "summary":
        cmd_summary(args)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
