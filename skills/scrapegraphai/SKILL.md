---
name: scrapegraphai
description: Web scraping with ScrapeGraphAI, the Python library that uses LLMs and graph logic to turn websites and local documents into structured data. Use whenever the user wants to extract content from a website or local document (HTML, XML, JSON, Markdown, PDF) by describing what they want, scrape a single page or multiple pages, turn search results into a report, generate a Python scraper script, or produce an audio summary of a page. Trigger for phrases like 'scrape this page', 'extract data from', 'pull product info from', 'scraping', 'web scraping', 'scraper', or when they ask to build an AI scraper pipeline, even if they don't say 'ScrapeGraphAI'.
---

# ScrapeGraphAI

Web scraping library (Python) that uses LLMs and graph/logic pipelines to extract the
information the user asks for from websites and local documents. Instead of writing CSS/XPath
selectors, you state **what** data you want and the pipeline figures out **how** to get it.

MIT licensed. Open-source repo: `ScrapeGraphAI/Scrapegraph-ai`. Docs: https://docs.scrapegraphai.com

## When to use this vs alternatives

- Use this skill when the target needs **LLM-driven extraction** (free-form content, messy
  layouts, anti-static pages) or the user explicitly asks for an AI scraper.
- If the user just wants raw HTML or simple selectors, a plain `requests` + selector approach is
  cheaper and should be preferred — call that out before spinning up an LLM pipeline.

## Install

```
pip install scrapegraphai
playwright install        # required for fetching JS-rendered websites
```

Recommended: install in a virtual environment. The library pulls in many dependencies and
normally conflicts with others.

## Core concept: graph configuration

Every pipeline takes an LLM config block. The LLM can be local (Ollama), an API model
(OpenAI, Groq, Azure, Gemini, MiniMax, etc.), or even a local `transformers` model.

```python
graph_config = {
    "llm": {
        "model": "ollama/llama3.2",      # local model name
        "model_tokens": 8192,
        "format": "json",                 # force JSON output where supported
    },
    "verbose": True,
    "headless": False,                    # keep browser window visible for debugging
}
```

To switch providers, only the `llm` block changes:

```python
graph_config = {
    "llm": {
        "api_key": "YOUR_OPENAI_API_KEY",
        "model": "openai/gpt-4o-mini",
    },
    "verbose": True,
    "headless": False,
}
```

Ollama models must already be downloaded: `ollama pull <model>`. When running a local LLM
with a browser, keep `headless` `False` set appropriately; headless mode works but hides
rendering issues.

## Pipelines

Pick the pipeline that matches the job:

| Pipeline | Job |
|----------|-----|
| `SmartScraperGraph` | Single page, one prompt, one source (URL or file path or HTML string). Most common. |
| `SmartScraperMultiGraph` | Multiple pages, one prompt, list of sources. |
| `SearchGraph` | Searches a search engine, scrapes the top n results, returns a combined answer. |
| `ScriptCreatorGraph` | Returns a Python scraping script (not data) for a page. |
| `ScriptCreatorMultiGraph` | Returns a Python scraping script for multiple pages/sources. |
| `SpeechGraph` | Extracts page content and returns a text summary (optionally an audio file). |
| `DeepScraperGraph` | Deep multi-step extraction with intermediate elaborations; use for complex/nested data. |

## Single-page extraction (SmartScraperGraph)

```python
from scrapegraphai.graphs import SmartScraperGraph
import json

graph_config = {
    "llm": {
        "api_key": "YOUR_OPENAI_API_KEY",
        "model": "openai/gpt-4o-mini",
    },
    "verbose": True,
    "headless": False,
}

smart_scraper_graph = SmartScraperGraph(
    prompt="Extract a description of what the company does, its founders, and social media links",
    source="https://scrapegraphai.com/",
    config=graph_config,
)

result = smart_scraper_graph.run()
print(json.dumps(result, indent=4))
```

`run()` can be called multiple times to retry or re-prompt; state persists across calls until
the graph is garbage collected.

## Multiple pages (SmartScraperMultiGraph)

```python
from scrapegraphai.graphs import SmartScraperMultiGraph

graph_config = {
    "llm": {"api_key": "YOUR_OPENAI_API_KEY", "model": "openai/gpt-4o-mini"},
    "verbose": True,
    "headless": False,
}

multiple_scraper = SmartScraperMultiGraph(
    prompt="Extract the title and price of each product",
    source=[
        "https://example.com/products/1",
        "https://example.com/products/2",
        "https://example.com/products/3",
    ],
    config=graph_config,
)

result = multiple_scraper.run()
```

Passing a single URL string also works; it is treated as a one-item list.

## Search-based extraction (SearchGraph)

```python
from scrapegraphai.graphs import SearchGraph

graph_config = {
    "llm": {"api_key": "YOUR_OPENAI_API_KEY", "model": "openai/gpt-4o-mini"},
    "verbose": True,
    "headless": False,
}

search_graph = SearchGraph(
    prompt="Summarize the latest developments in LLM-based web scraping",
    config=graph_config,
)

result = search_graph.run()
```

`SearchGraph` needs a search backend; if none is configured it falls back to DuckDuckGo and
may need verification captchas. If search fails, configure a supported search API rather than
hard-coding a single result page.

## Script generation (ScriptCreatorGraph)

```python
from scrapegraphai.graphs import ScriptCreatorGraph

script_creator = ScriptCreatorGraph(
    prompt="Write a script that extracts the main navigation links from this page",
    source="https://example.com",
    config=graph_config,
)

script = script_creator.run()
```

The result is Python source code, not data. Use it when the user wants a reusable scraper
instead of one-off extraction.

## Local file sources

`source` accepts a local file path for HTML, XML, JSON, Markdown, and similar text formats.
The content is read and fed to the LLM the same way as a page fetch. Use this for offline
documents the user wants parsed.

## Scripts and module-level scraping

The package also exposes direct scraping utilities (`scrapegraphai.utils` and related
`scrape_` functions) for simple cases where a full pipeline is overkill — e.g.,
`scrapegraphai.utils.scrape_text` for in-memory HTML string scraping. Prefer the graph classes
above for real tasks; they keep config consistent.

## Managed cloud API (alternative, not this library)

These are **separate paid products** — do not mix them into the open-source library code.

- Python SDK: `pip install scrapegraph-py`, uses `SGAI_API_KEY`
- JS/TS SDK: `scrapegraph-js`
- MCP server: `@ScrapeGraphAI/scrapegraph-mcp` (via smithery.ai)
- Capabilities: Scrape, Extract, Search, Crawl, Monitor, History

Only reach for these when the user explicitly wants the hosted API, cloud crawl/monitor jobs,
or an MCP integration.

## Common pitfalls

- Forgetting `playwright install` → fetch errors on JS-heavy sites.
- JSON parse failures → set `"format": "json"` in the llm block when available, and always
  pass a concrete, named output schema in the prompt (list the fields you want).
- Local Ollama models too weak → prefer `gpt-4o-mini` class models or prompt with a stricter
  schema.
- Unstable/weak models hallucinate fields → ask the user for a target schema, or lower the
  amount of free-form text requested.
- Vague prompts ("extract everything") → list the exact fields/keys expected in the output.
- Telemetry: set `SCRAPEGRAPHAI_TELEMETRY_ENABLED=false` if the user wants to opt out of
  anonymous usage metrics.

## Verify output

- Print the result as JSON and sanity-check that every requested field is present and typed
  correctly.
- Spot-check one extracted value against the source page.
- For `SearchGraph`, confirm sources actually came from the search engine and weren't
  hallucinated.