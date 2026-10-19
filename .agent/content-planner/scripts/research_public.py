#!/usr/bin/env python3
import argparse
import json
import re
import sys
import time
from datetime import date
from pathlib import Path
from urllib.parse import urlparse, quote_plus

from playwright.sync_api import sync_playwright

from scrape_public import scrape as scrape_page

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output"

THEME_KEYWORDS = (
    "ai education", "ai academy", "bootcamp", "upskilling", "tech career",
    "digital marketing", "data analytics", "generative ai", "ai agents",
    "learning in public", "portfolio project", "hiring partners", "career switch",
    "content marketing", "social media strategy", "short form video",
    "linkedin content", "creator economy", "online course",
)
FORMAT_HINTS = (
    "reel", "carousel", "thread", "case study", "student story", "tutorial",
    "before and after", "day in the life", "myth", "q&a", "live", "workshop",
)


def search_urls(query: str, limit: int = 20) -> list[str]:
    urls: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0.0.0 Safari/537.36"
            )
        )
        page.goto(f"https://search.yahoo.com/search?p={quote_plus(query)}", timeout=30000)
        page.wait_for_timeout(2500)
        hrefs = page.eval_on_selector_all("a", "els => els.map(e => e.href)")
        browser.close()
    skip_hosts = (
        "yahoo.com", "login.yahoo.com", "help.yahoo.com",
        "images.search.yahoo.com", "video.search.yahoo.com",
        "news.search.yahoo.com", "shopping.yahoo.com",
    )
    for href in hrefs:
        if not href or not href.startswith("http"):
            continue
        host = urlparse(href).netloc.replace("www.", "")
        if any(host == s or host.endswith("." + s) for s in skip_hosts):
            continue
        if href not in urls:
            urls.append(href)
        if len(urls) >= limit:
            break
    return urls


def extract_themes(record: dict) -> list[str]:
    text = " ".join(
        [record.get("title") or "", record.get("meta_description") or "", record.get("text") or ""]
    ).lower()
    found = [k for k in THEME_KEYWORDS if k in text]
    formats = [f for f in FORMAT_HINTS if f in text]
    themes = [f"theme:{t}" for t in found[:5]] + [f"format:{f}" for f in formats[:3]]
    return themes


def run(query: str, slug: str, max_sources: int) -> int:
    today = date.today().isoformat()
    run_dir = OUTPUT_DIR / f"run-{today}-{slug}"
    run_dir.mkdir(parents=True, exist_ok=True)

    urls = search_urls(query, limit=max_sources * 3)
    domain_counts: dict[str, int] = {}
    sources = []
    scanned = 0

    for url in urls:
        if scanned >= max_sources * 2:
            break
        domain = urlparse(url).netloc.replace("www.", "")
        if domain_counts.get(domain, 0) >= 2:
            continue
        domain_counts[domain] = domain_counts.get(domain, 0) + 1
        record = scrape_page(url)
        scanned += 1
        time.sleep(1.0)
        themes = extract_themes(record)
        sources.append(
            {
                "url": url,
                "title": record.get("title") or "",
                "blocked": bool(record.get("blocked")),
                "error": record.get("error"),
                "excerpt": (record.get("text") or "")[:600],
                "themes": themes,
                "score": min(100, len(themes) * 15 + (10 if record.get("title") else 0)),
            }
        )

    sources.sort(key=lambda s: s["score"], reverse=True)
    sources = sources[:max_sources]
    research = {
        "query": query,
        "slug": slug,
        "date": today,
        "scanned": scanned,
        "sources": sources,
        "pattern_notes": _patterns(sources),
    }
    (run_dir / "research.json").write_text(
        json.dumps(research, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    lines = [
        f"# Research — {slug}",
        "",
        f"Query: `{query}`",
        f"Scanned: {scanned} | Sources kept: {len(sources)}",
        "",
        "## Patterns",
    ]
    lines.extend(f"- {p}" for p in research["pattern_notes"] or ["(none)"])
    lines += ["", "| Score | Title | URL | Themes |", "|------:|-------|-----|---------|"]
    for s in sources:
        lines.append(
            "| {score} | {title} | {url} | {themes} |".format(
                score=s["score"],
                title=(s["title"] or "-")[:60].replace("|", "/"),
                url=s["url"],
                themes=", ".join(s["themes"])[:100] or "-",
            )
        )
    (run_dir / "research.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"run_dir": str(run_dir), "scanned": scanned, "kept": len(sources)}, indent=2))
    return 0


def _patterns(sources: list[dict]) -> list[str]:
    counts: dict[str, int] = {}
    for s in sources:
        for t in s.get("themes") or []:
            counts[t] = counts.get(t, 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    return [f"{k} (seen in {v} sources)" for k, v in ranked[:6]]


def main() -> int:
    parser = argparse.ArgumentParser(description="Public-web content research")
    sub = parser.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("query")
    s.add_argument("--limit", type=int, default=10)
    r = sub.add_parser("run")
    r.add_argument("--query", required=True)
    r.add_argument("--slug", required=True)
    r.add_argument("--max", type=int, default=8)
    args = parser.parse_args()
    if args.cmd == "search":
        for u in search_urls(args.query, limit=args.limit):
            print(u)
        return 0
    return run(args.query, args.slug, args.max)


if __name__ == "__main__":
    sys.exit(main())
