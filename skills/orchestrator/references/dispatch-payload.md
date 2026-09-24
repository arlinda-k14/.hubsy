# Dispatch Payload & State Schema

Load this file when preparing a handoff, verifying worker completion, or persisting orchestrator state.

## Dispatch payload

Every dispatch is a signed JSON envelope. Signing lets a downstream worker verify the payload is from the orchestrator without trusting the transport channel. The orchestrator never reads a payload back after sending; it only watches worker events.

```json
{
  "schema_version": "1.0",
  "dispatch_id": "uuid-string",
  "session_id": "uuid-string",
  "skill": "content-drafting",
  "sub_skill": "social-copy",
  "action": "draft one LinkedIn post from the brief",
  "task_prompt": "cleaned, parameter-stripped version of the user's request",
  "user_profile": {
    "name": "user name if known",
    "role": "role if known",
    "business_context": "context if known"
  },
  "parameters": {
    "tone": "professional",
    "platform": "linkedin",
    "length": "200 words"
  },
  "dependencies": [],
  "expected_events": ["worker.started", "worker.completed"],
  "issued_at": "2026-09-22T00:00:00Z"
}
```

`dependencies` carries the execution order and intermediate outputs when a prompt was split into multiple sub-tasks. A downstream worker with an empty `dependencies` array knows it runs first and must publish its own intermediate output back to the event bus for the next worker.

## Signing (HMAC-SHA256)

Signature = hex lowercase HMAC-SHA256 of `issued_at + "." + canonical_json_body`, keyed by the dispatcher's shared secret.

Required request header:

```
X-Dispatch-Signature: sig=HEX_HMAC, t=ISSUED_AT
```

Workers MUST recompute the signature and reject the payload on mismatch or clock skew beyond 5 minutes. The secret lives in orchestrator config only -- never inline it in a payload.

## Transports

Default transport is a webhook captured by the worker skill; worker skills may register a queue topic instead. Either way the envelope, signature, and event contract are identical. If a dispatch cannot be delivered:
- notify the user immediately,
- enqueue the envelope in the SQLite retry buffer with an incremented `attempt`,
- ask whether to pause or select an alternative skill.

## Worker events

Workers publish events named `<worker>.<state>` (e.g. `content-drafting.started`, `content-drafting.completed`) to the central event bus / session manager. The orchestrator:
- verifies `worker.started` then `worker.completed` for each dispatch_id,
- watches event names only, never the payload body,
- clears routing context after a confirmed completion,
- if a worker is unreachable or events time out, falls back to the retry buffer path above.

## SQLite state store (`memory/orchestrator.db`)

Created/maintained by `scripts/orchestrator_store.py`.

```sql
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
```

Why SQLite over Redis: it has no moving parts on a personal machine, persists across restarts, and the orchestrator's write volume is trivial. Keep live clarification context in the short-term cache (the in-memory session), not in SQLite; SQLite is for durable tracing and retries.