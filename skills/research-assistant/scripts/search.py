#!/usr/bin/env python3
"""Web search for the research-assistant skill (Tavily, stdlib only).

Reads TAVILY_API_KEY from the environment (never hardcoded). Retries once on
failure, then reports the failure - returning any partial results labelled as
partial. When no live sources can be fetched at all, exits with a plain message
so SKILL.md's error-handling rule ("never fabricate URLs/statistics/citations")
can be followed.

Usage:
    python3 scripts/search.py --query "cloud hiring demand" \
        --topic hiring --region "Kosovo and Balkans" --depth quick \
        [--out data/last_search.json] [--max-results 8]
"""
import argparse
import datetime
import json
import os
import sys
import time
import urllib.error
import urllib.request

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(SKILL_ROOT, "config", "sources.json")
TOPICS_PATH = os.path.join(SKILL_ROOT, "config", "topics.json")
HTTP_TIMEOUT = 30
RETRY_DELAY = 2  # seconds


def load_json(path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def log(message):
    sys.stderr.write(message.rstrip() + "\n")


def compose_queries(user_query, region, topic_id, depth):
    """Primary query plus, for deep depth, the topic's query templates."""
    queries = [user_query.strip()]
    if depth == "deep" and topic_id:
        try:
            topics = load_json(TOPICS_PATH).get("topics", [])
        except (OSError, ValueError):
            topics = []
        topic = next((t for t in topics if t.get("id") == topic_id), None)
        for template in (topic or {}).get("query_templates", [])[:3]:
            try:
                composed = template.format(query=user_query.strip(), region=region)
            except (KeyError, IndexError):
                composed = user_query.strip()
            if composed and composed not in queries:
                queries.append(composed)
    if region:
        regional = "%s %s" % (queries[0], region)
        if regional not in queries:
            queries.append(regional)
    return queries[:4]


def tavily_request(endpoint, api_key, query, max_results, search_depth):
    body = json.dumps({
        "query": query,
        "max_results": max_results,
        "search_depth": search_depth,
        "api_key": api_key,  # legacy field; Authorization header is primary
    }).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Authorization": "Bearer %s" % api_key,
            "Content-Type": "application/json",
            "User-Agent": "research-assistant-skill/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def run_search(config, queries, api_key, max_results, search_depth):
    """Run all queries with per-query retry. Returns (results, failures)."""
    endpoint = config["search"]["endpoint"]
    results, failures = [], []
    for query in queries:
        payload = None
        last_error = None
        for attempt in range(2):  # retry once per SKILL.md error handling
            try:
                payload = tavily_request(endpoint, api_key, query, max_results, search_depth)
                break
            except urllib.error.HTTPError as exc:
                last_error = "HTTP %s: %s" % (exc.code, exc.reason)
                if exc.code in (401, 403, 404):
                    break  # auth/config errors will not be fixed by retrying
            except (urllib.error.URLError, OSError, ValueError) as exc:
                last_error = str(exc)
            if attempt == 0:
                time.sleep(RETRY_DELAY)
        if payload is None:
            failures.append({"query": query, "error": last_error or "unknown error"})
        else:
            for item in payload.get("results", []) or []:
                results.append({
                    "title": item.get("title") or "",
                    "url": item.get("url") or "",
                    "content": item.get("content") or "",
                    "published_date": item.get("published_date") or "",
                    "score": item.get("score"),
                    "source_query": query,
                })
    return results, failures


def dedupe(results):
    seen, unique = set(), []
    for item in results:
        url = (item.get("url") or "").rstrip("/")
        if not url or url in seen:
            continue
        seen.add(url)
        unique.append(item)
    return unique


def main():
    parser = argparse.ArgumentParser(description="Tavily web search for research-assistant")
    parser.add_argument("--query", required=True, help="research query")
    parser.add_argument("--topic", default=None, help="topic id from config/topics.json")
    parser.add_argument("--region", default="Kosovo and Balkans")
    parser.add_argument("--depth", choices=["quick", "deep"], default="quick")
    parser.add_argument("--max-results", type=int, default=None)
    parser.add_argument("--out", default=None, help="write JSON results to this path")
    args = parser.parse_args()

    try:
        config = load_json(CONFIG_PATH)
    except (OSError, ValueError) as exc:
        log("SEARCH UNAVAILABLE: cannot read config/sources.json (%s)." % exc)
        sys.exit(2)

    api_key = os.environ.get(config["search"].get("env_key", "TAVILY_API_KEY"), "").strip()
    if not api_key:
        log("SEARCH UNAVAILABLE: %s is not set. No live sources can be provided - "
            "do not fabricate URLs, statistics, or citations."
            % config["search"].get("env_key", "TAVILY_API_KEY"))
        sys.exit(2)

    max_results = args.max_results or config["search"].get("max_results", 8)
    search_depth = config["search"].get("search_depth", "advanced")
    queries = compose_queries(args.query, args.region, args.topic, args.depth)

    results, failures = run_search(config, queries, api_key, max_results, search_depth)
    results = dedupe(results)
    partial = bool(failures) and bool(results)
    total_failure = bool(failures) and not results

    if total_failure:
        log("SEARCH FAILED after up to %d attempt(s) per query: %s"
            % (config["search"].get("retry_on_failure", 1) + 1,
               "; ".join("%s -> %s" % (f["query"], f["error"]) for f in failures)))
        sys.exit(3)

    payload = {
        "provider": config["search"]["provider"],
        "retrieved_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "queries": queries,
        "region": args.region,
        "topic": args.topic,
        "depth": args.depth,
        "partial": partial,
        "failures": failures,
        "results": results,
        "sources": [
            {"title": r["title"], "url": r["url"], "published_date": r["published_date"]}
            for r in results
        ],
    }

    rendered = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.out:
        out_path = args.out if os.path.isabs(args.out) else os.path.join(SKILL_ROOT, args.out)
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as fh:
            fh.write(rendered)
        log("Wrote %d results (%d unique sources)%s to %s"
            % (len(results), len(payload["sources"]),
               " [PARTIAL - some queries failed]" if partial else "", out_path))
    else:
        print(rendered)

    if partial:
        log("PARTIAL RESULTS: %d query failure(s): %s"
            % (len(failures), "; ".join(f["error"] for f in failures)))
    sys.exit(0)


if __name__ == "__main__":
    main()
