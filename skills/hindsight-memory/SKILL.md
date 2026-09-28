---
name: hindsight-memory
description: Long-term memory management for Hubsy powered by the Hindsight engine (vectorize-io/hindsight). Capture what the user says and does into persistent memory (Retain), fetch past facts and experiences to ground answers (Recall), and build durable user mental models that personalize every session (Reflect). Use whenever the user states a personal fact or preference ("remember that I..."), asks about something discussed before ("what did we agree on", "what do you know about me"), starts a new session that should feel continuous, or needs an answer that requires reasoning over accumulated history rather than a single lookup. Trigger keywords: hindsight, retain, recall, reflect, memory, remember, long-term memory, user profile, mental model.
---

# Hindsight Memory

You are Hubsy's long-term memory layer, backed by the Hindsight engine
(https://github.com/vectorize-io/hindsight). Hindsight is an agent memory
system that makes an agent **learn**, not just remember. It organizes memories
the way human memory works — world facts, experiences, observations, and
mental models — instead of a flat pile of conversation history.

Hubsy plays three roles against the engine:

1. **Retain** — capture context into memory as it happens.
2. **Recall** — fetch past facts and experiences to ground current answers.
3. **Reflect** — build and maintain user mental models for personalization.

## When to use this skill

- The user states something worth remembering: facts, preferences, goals,
  constraints, decisions, corrections. ("Remember that I prefer dark mode,
  and use British English.")
- The user references something from a past session: "What did we agree last
  week?", "Remind me about X", "What do you know about me?"
- A session starts and the user expects continuity — boot with recalled
  context instead of asking them to repeat themselves.
- A question needs reasoning over accumulated history, not a single lookup —
  e.g. "What should I keep in mind about this project?"

## The three operations

### Retain: capture context

Retain pushes new memory items into a Hindsight bank. Every meaningful fact,
decision, correction, or task outcome the user expresses is a retain
candidate. Prefer small, atomic statements over one giant blob: the engine
extracts entities, temporal data, and relationships from each item.

Pass optional metadata (`context`, `timestamp`) when it clarifies the memory.

```python
from hindsight_client import Hindsight

client = Hindsight(base_url="http://localhost:8888")

client.retain(
    bank_id="arlinda",
    content="Arlinda prefers British English and concise to-the-point replies",
    context="writing preference",
    timestamp="2026-09-28T12:00:00Z",
)
```

Rules for good retain items:

- Retain one fact per call, phrased as a standalone statement.
- Include named entities (people, projects, tools) so the graph index can
  link them.
- Retain corrections explicitly — a correction should override, not pile on.
- Never retain secrets or PII unless the bank's Memory Defense policy is
  configured to redact it.

### Recall: fetch past facts and experiences

Recall retrieves memories relevant to the current context. It runs four
retrieval strategies in parallel — semantic vector similarity, BM25 keyword
matching, graph (entity/temporal/causal) links, and time-range filtering —
then merges results with reciprocal rank fusion and cross-encoder reranking.

```python
facts = client.recall(
    bank_id="arlinda",
    query="What does Arlinda prefer in her writing?",
)
```

Rules for good recall queries:

- Ask recall before asserting anything about the user from long-term memory.
- Use temporal queries directly ("What happened in June?") — the time series
  pathway handles them.
- Review the returned memories and ground the answer in them; never invent a
  memory the engine did not return.
- If a fact is still missing, that is a retain gap — note it and retain the
  answer once known.

### Reflect: build user mental models

Reflect performs deeper analysis over the bank's memories to form new
connections and build a thorough understanding — a mental model — of the
user and their world. Use it when the answer requires synthesis rather than
lookup: preferences, motivations, risks, open questions.

```python
model = client.reflect(
    bank_id="arlinda",
    query="What should I know about Arlinda's writing style?",
)
```

Where recall returns evidence, reflect returns reasoning grounded in the
bank's accumulated observations. Bank **disposition traits** (skepticism,
literalism, empathy) shape how reflect reasons, so tailor the query, not the
tone.

Prefer standalone **mental models** for questions that recur every session
(e.g. "What are this user's preferences?"): define the question once and
Hindsight keeps the answer current; reading it is a database read, no LLM
call, so it is cheap to load at session boot.

## Memory types

| Type | Description |
|------|-------------|
| World facts | Things about the world: "The stove gets hot" |
| Experiences | Hubsy's own encounters: "Last session we refactored the scraper" |
| Observations | Consolidated, evidence-backed beliefs built from many memories |
| Mental models | Learned understanding of the user, synthesized from observations and facts |

## Banks

A **bank** is one isolated memory store — one brain per user, agent, or
project. Use a dedicated bank per user or project so there is no cross-bank
leakage. Never mix personal and project memories in one bank.

## Integration notes

- Self-hosted server: `http://localhost:8888` (API), `:9999` (UI). Start via
  Docker (`ghcr.io/vectorize-io/hindsight:latest`) or `pip install hindsight-api`.
- Embedded (no server): `pip install hindsight-all`, then run a local
  `HindsightServer` in-process.
- MCP: every bank exposes `http://localhost:8888/mcp/{bank_id}/` exposing
  retain, recall, and reflect as tools.
- Missing operational detail: read `references/hindsight-architecture.md`
  first, then the upstream docs at https://hindsight.vectorize.io.

## Session flow

1. **Boot** — read the relevant mental model(s) for the active user/project
   bank so the session starts warm.
2. **During** — recall before answering anything user-specific; reflect for
   synthesis questions.
3. **After** — retain what happened: new facts, decisions, outcomes,
   corrections. Memory that is never written is memory that never exists.