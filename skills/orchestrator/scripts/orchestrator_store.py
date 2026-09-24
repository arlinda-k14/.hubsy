#!/usr/bin/env python3
"""SQLite helpers for the orchestrator skill.

Usage:
  python3 orchestrator_store.py init                       # create tables
  python3 orchestrator_store.py trace <session> <prompt> [<skill> <conf>]
  python3 orchestrator_store.py error <session> <prompt> <route> [correction]
  python3 orchestrator_store.py enqueue <dispatch_id> <envelope_json>
  python3 orchestrator_store.py confirm <session_id>       # mark session cleared
  python3 orchestrator_store.py retries                   # list retry buffer
"""

import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone

DB_PATH = "/Users/arlindakaloshi/.hubsy/memory/orchestrator.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  cleared_at TEXT
);

CREATE TABLE IF NOT EXISTS intent_traces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  raw_prompt TEXT NOT NULL,
  classified_skill TEXT,
  confidence REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS routing_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  raw_prompt TEXT NOT NULL,
  rejected_route TEXT NOT NULL,
  user_correction TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS retry_buffer (
  dispatch_id TEXT PRIMARY KEY,
  envelope_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  enqueued_at TEXT NOT NULL,
  last_error TEXT
);
"""


def now():
    return datetime.now(timezone.utc).isoformat()


def connect():
    return sqlite3.connect(DB_PATH)


def cmd_init():
    with connect() as con:
        con.executescript(SCHEMA)
    print("tables ready at", DB_PATH)


def cmd_trace(args):
    session_id = args[0]
    prompt = args[1]
    skill = args[2] if len(args) > 2 else None
    confidence = float(args[3]) if len(args) > 3 else None
    with connect() as con:
        con.execute(
            "INSERT OR IGNORE INTO sessions (session_id, created_at) VALUES (?, ?)",
            (session_id, now()),
        )
        con.execute(
            "INSERT INTO intent_traces (session_id, raw_prompt, classified_skill, confidence, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (session_id, prompt, skill, confidence, now()),
        )
    print("trace recorded")


def cmd_error(args):
    session_id = args[0] or None
    prompt = args[1]
    route = args[2]
    correction = args[3] if len(args) > 3 else None
    with connect() as con:
        con.execute(
            "INSERT INTO routing_errors (session_id, raw_prompt, rejected_route, user_correction, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (session_id, prompt, route, correction, now()),
        )
    print("routing error logged")


def cmd_enqueue(args):
    dispatch_id = args[0]
    envelope_json = args[1]
    with connect() as con:
        con.execute(
            "INSERT OR REPLACE INTO retry_buffer (dispatch_id, envelope_json, attempts, enqueued_at, last_error)"
            " VALUES (?, ?, COALESCE((SELECT attempts FROM retry_buffer WHERE dispatch_id = ?), 0) + 1, ?, NULL)",
            (dispatch_id, envelope_json, dispatch_id, now()),
        )
    print("enqueued, attempt incremented")


def cmd_confirm(args):
    session_id = args[0]
    with connect() as con:
        con.execute("UPDATE sessions SET cleared_at = ? WHERE session_id = ?", (now(), session_id))
    print("session cleared")


def cmd_retries():
    with connect() as con:
        rows = con.execute(
            "SELECT dispatch_id, attempts, enqueued_at, last_error FROM retry_buffer ORDER BY enqueued_at DESC"
        ).fetchall()
    for row in rows:
        print(row)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    sub = sys.argv[1]
    args = sys.argv[2:]

    if sub == "init":
        cmd_init()
    elif sub == "trace" and len(args) >= 2:
        cmd_trace(args)
    elif sub == "error" and len(args) >= 3:
        cmd_error(args)
    elif sub == "enqueue" and len(args) >= 2:
        cmd_enqueue(args)
    elif sub == "confirm" and len(args) == 1:
        cmd_confirm(args)
    elif sub == "retries":
        cmd_retries()
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()