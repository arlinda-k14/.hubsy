# Hindsight Architecture

Reference for the Hindsight engine (vectorize-io/hindsight), the memory
system behind this skill. Hindsight is agent memory that *learns*, not just
remembers. Source: https://github.com/vectorize-io/hindsight and
https://hindsight.vectorize.io.

## Overview

Hindsight replaces naive vector-search RAG and knowledge graphs with
biomimetic data structures. Memory items are stored in **banks** and pushed
into either a *world facts* or *experiences* pathway, then represented as
entities, relationships, and time series with sparse/dense vector
representations. Three client-facing operations — **Retain**, **Recall**,
**Reflect** — plus background consolidation make up the engine's surface.

## The three operations

### Retain

Push new memories into a bank. An input like
`"Alice got promoted to senior engineer"` is ingested and, using an LLM,
Hindsight extracts key facts, temporal data, entities, and relationships,
then normalizes them into canonical entities, time series, and search
indexes with metadata. These representations create the pathways that make
later retrieval accurate.

```python
client.retain(
    bank_id="my-bank",
    content="Alice got promoted to senior engineer",
    context="career update",
    timestamp="2025-06-15T10:00:00Z",
)
```

Docs: https://hindsight.vectorize.io/developer/retain

### Recall

Retrieve memories relevant to a query. Answers can come from any memory type
(world facts, experiences, observations, mental models). Recall runs **four
retrieval strategies in parallel**:

1. **Semantic** — vector similarity (dense embeddings)
2. **Keyword** — BM25 exact matching (sparse)
3. **Graph** — entity, temporal, and causal links
4. **Temporal** — time-range filtering

Results are merged, ordered by relevance via reciprocal rank fusion plus a
cross-encoder reranking model, then trimmed to fit the token budget.

```python
client.recall(bank_id="my-bank", query="What does Alice do?")
client.recall(bank_id="my-bank", query="What happened in June?")  # temporal
```

Docs: https://hindsight.vectorize.io/developer/retrieval

### Reflect

Perform deeper analysis over existing memories. Where recall is lookup,
reflect is synthesis: it forms new connections between memories, builds a
thorough understanding of the bank's world, or answers a question that needs
reasoning rather than retrieval. Each bank carries **disposition traits**
(skepticism, literalism, empathy) that steer how reflect reasons.

Typical uses: a project manager reflecting on risks, a sales agent reflecting
on why messages work, a support agent reflecting on documentation gaps.

```python
client.reflect(bank_id="my-bank", query="What should I know about Alice?")
```

Docs: https://hindsight.vectorize.io/developer/reflect

## Supporting concepts

### Memory types

| Type | Example |
|------|---------|
| World facts | "The stove gets hot" |
| Experiences | "I touched the stove and it really hurt" |
| Observations | Consolidated, evidence-backed beliefs formed from many memories |
| Mental models | Learned understanding of an agent's world, synthesized from observations and facts |

### Observations

Retained facts do not stay a flat pile. In the background Hindsight
consolidates related facts into **observations** — deduplicated beliefs with
supporting evidence (exact quotes and a proof count). Observations are
*refined* rather than overwritten, so new evidence strengthens, weakens, or
extends an existing belief instead of silently replacing it.

Docs: https://hindsight.vectorize.io/developer/observations

### Mental models & knowledge pages

A **mental model** is a standing answer to a question about a bank (e.g.
"What are this user's preferences?"). The question is defined once; Hindsight
writes the answer, stores it, and rewrites it in the background as the bank
learns. Reading one is a database read — no retrieval, no LLM call — so an
agent can boot with a page of settled knowledge.

**Knowledge pages** are mental models with the mechanics hidden: living
documents a bank writes about itself, organized wiki-style, searchable, and
projectable onto disk as markdown.

Docs: https://hindsight.vectorize.io/developer/mental-models

### Memory banks

A **bank** is an isolated memory store — one brain for one user, agent, or
project. Isolation is strict: no cross-bank leakage. Banks carry background
context and disposition traits, and can be created from declarative bank
templates.

### Safety features

- **Multilingual by default** — input language is detected and preserved;
  entities keep their native script.
- **Memory Defense** — an opt-in per-bank policy scanning every retain for
  secrets and PII (45 patterns), redacting (`[REDACTED:github_token]`) or
  blocking items before storage.

Docs: https://hindsight.vectorize.io/developer/memory-defense

## Deployment surface

- **Server**: Docker (`ghcr.io/vectorize-io/hindsight:latest`), bare metal
  (`pip install hindsight-api`), Helm, or managed Hindsight Cloud. API on
  `:8888`, UI on `:9999`.
- **Clients**: Python (`hindsight-client`), Node.js
  (`@vectorize-io/hindsight-client`), Go, CLI, and a REST API.
- **LLM Wrapper**: `hindsight-litellm` wraps an existing OpenAI/Anthropic
  client so retain/recall happen automatically per call.
- **MCP**: each server exposes `http://localhost:8888/mcp/{bank_id}/`,
  exposing retain, recall, and reflect as tools.
- **Embedded**: `pip install hindsight-all` runs an in-process
  `HindsightServer` (no external server required).
- **Storage**: PostgreSQL + pgvector, or Oracle AI Database 23ai.
- **Integrations**: 60+ (LangGraph, CrewAI, Claude Code, Codex, opencode,
  n8n, Obsidian, ChatGPT, ...), mostly no-code.

## Benchmark & provenance

Hindsight reports state-of-the-art (SOTA) accuracy on the LongMemEval
benchmark; live per-model accuracy/latency/cost results are published at
https://benchmarks.hindsight.vectorize.io. The system is MIT-licensed and
documented in the paper https://arxiv.org/abs/2512.12818.