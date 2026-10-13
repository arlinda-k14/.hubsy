# Dispatch Payload & Route-Trace State

Load this file when preparing a CSO -> sub-agent handoff, verifying sub-agent completion, or
persisting CSO route state. It mirrors the orchestrator's `references/dispatch-payload.md`,
one layer down.

## Dispatch payload

Every handoff from the CSO to a sub-agent is a signed JSON envelope. Signing lets the sub-agent
verify the payload came from the CSO without trusting the transport channel. The CSO never reads
a payload back after sending; it only watches sub-agent events.

```json
{
  "schema_version": "1.0",
  "dispatch_id": "uuid-string",
  "session_id": "uuid-string",
  "sub_agent": "pipeline | outreach | discovery | closing | revenue-analytics",
  "action": "one sentence, what must exist when this is done",
  "task_prompt": "cleaned, parameter-stripped version of the routed request",
  "business_context": {
    "business": "Creative Hub Kosovo",
    "audience": "career switchers in Kosovo and worldwide-remote"
  },
  "parameters": {
    "program": "digital-marketing",
    "lead_refs": ["dl-0042"],
    "channel": "email"
  },
  "dependencies": ["dispatch_id this waits on"],
  "expected_events": ["cso.<sub_agent>.started", "cso.<sub_agent>.completed"],
  "issued_at": "2026-10-13T08:00:00Z"
}
```

`dependencies` carries the execution order and intermediate outputs when a request was split
across stages. A sub-agent with an empty `dependencies` array runs first and must publish its
intermediate output back to the event bus for the next sub-agent.

## Signing (HMAC-SHA256)

Signature = hex lowercase HMAC-SHA256 of `issued_at + "." + canonical_json_body`, keyed by the
CSO's shared secret with its workers. Required header:

```
X-Dispatch-Signature: sig=HEX_HMAC, t=ISSUED_AT
```

Sub-agents MUST recompute the signature and reject the payload on mismatch or clock skew beyond
5 minutes. The secret lives in CSO config only - never inline it in a payload.

## Transports

Default transport is a webhook captured by the sub-agent; sub-agents may register a queue topic
instead. If a dispatch cannot be delivered:

- notify the caller immediately,
- enqueue the envelope in the SQLite retry buffer with an incremented `attempt`,
- ask whether to pause or route to an alternative sub-agent.

## Sub-agent events

Sub-agents publish events named `cso.<sub_agent>.<state>` (e.g. `cso.outreach.started`,
`cso.outreach.completed`). The CSO:

- verifies `started` then `completed` for each `dispatch_id`,
- watches event names only, never the payload body,
- clears routing context after a confirmed completion,
- falls back to the retry buffer path on timeout or unreachability.

## SQLite state store (`memory/cso.db`)

Created/maintained by `scripts/cso_store.py`. Routing only - no deliverables are ever stored here.

```sql
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  cleared_at TEXT
);

CREATE TABLE IF NOT EXISTS route_traces (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  raw_prompt   TEXT NOT NULL,
  sub_agent    TEXT,
  confidence   REAL,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS route_errors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT,
  raw_prompt      TEXT NOT NULL,
  rejected_route  TEXT NOT NULL,
  user_correction TEXT,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS retry_buffer (
  dispatch_id TEXT PRIMARY KEY,
  envelope_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  enqueued_at TEXT NOT NULL,
  last_error TEXT
);
```

Why SQLite: it matches `memory/orchestrator.db` and `memory/cmo.db`, has no moving parts on a
personal machine, and the CSO's write volume is trivial. Keep live clarification context in the
in-memory session, not in SQLite; SQLite is for durable route traces and retries.
