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

from scrape_public import scrape

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output"

SQ_HINTS = (
    "kosovo", "kosoves", "prishtin", "pristin", "albania", "tirana", "tiranë",
    "shqip", "gjakove", "peje", "ferizaj", "mitrovic", "ujmir", "xk",
)
INTENT_HINTS = (
    "open to work", "opentowork", "career switch", "career change", "career pivot",
    "looking for new", "seeking entry", "breaking into", "learning marketing",
    "learning data", "learning to code", "upskilling", "bootcamp", "akademi",
    "training", "certifikat", "hiring", "we are hiring", "job opening",
    "junior", "stagj", "internship", "praktikum",
)
ROLE_HINTS = (
    "marketing", "sales", "content", "community", "hr", "human resources",
    "recruiter", "project manager", "product", "analyst", "data", "developer",
    "designer", "operations", "coordinator", "manager", "founder", "ceo",
    "owner", "doktor", "mësues", "teacher",
)
NEGATIVE_HINTS = (
    "senior staff engineer", "principal engineer", "staff data scientist",
    "already enrolled", "multi-level marketing", "crypto signals", "loan offer",
)
MAX_SCANS_PER_DOMAIN = 2
BOARD_EMAIL_DOMAINS = (
    "kosovajob.com", "careers-page.com", "linkedin.com", "facebook.com",
    "indeed.com", "glassdoor.com", "joblift.com", "jooble.org",
)


def is_board_email(email: str) -> bool:
    host = email.split("@")[-1].lower()
    return any(host == d or host.endswith("." + d) for d in BOARD_EMAIL_DOMAINS)


def search_urls(query: str, limit: int = 25) -> list[str]:
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
        hrefs = page.eval_on_selector_all(
            "a",
            "els => els.map(e => e.href)",
        )
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


def score_record(record: dict, query: str) -> dict:
    text = " ".join(
        [
            record.get("title") or "",
            record.get("meta_description") or "",
            record.get("text") or "",
            record.get("url") or "",
            query,
        ]
    ).lower()
    score = 0
    reasons = []
    region = "other"
    if any(h in text for h in SQ_HINTS):
        score += 15
        region = "kosovo" if "kosov" in text or "prishtin" in text or "pristin" in text else "albania"
        reasons.append("region signal")
    intent_hits = [h for h in INTENT_HINTS if h in text]
    if intent_hits:
        score += min(35, 10 + 5 * len(intent_hits))
        reasons.append("intent: " + ", ".join(intent_hits[:4]))
    role_hits = [h for h in ROLE_HINTS if h in text]
    if role_hits:
        score += min(30, 8 * len(role_hits))
        reasons.append("role: " + ", ".join(role_hits[:4]))
    if record.get("emails"):
        score += 20
        reasons.append("public email found")
    elif any("linkedin.com" in (record.get("url") or "") for _ in [0]):
        score += 10
        reasons.append("profile url present")
    if any(h in text for h in NEGATIVE_HINTS):
        score = max(0, score - 40)
        reasons.append("negative signal")
    if record.get("blocked"):
        score = 0
        reasons.append("blocked page")
    academy_fit = []
    mapping = [
        ("digital marketing", ("marketing", "seo", "meta ads", "google ads", "content")),
        ("data-eng", ("data engineer", "etl", "cloud", "pipeline")),
        ("data-science", ("data scien", "analytics", "machine learning", "analyst")),
        ("fullstack", ("full stack", "full-stack", "developer", "javascript", "react")),
        ("product", ("product manager", "project manager", "product ops")),
        ("hr", ("human resources", " hr ", "recruiter", "talent")),
        ("vibe-coding", ("ai agent", "vibe coding", "no-code", "automation")),
    ]
    for name, keys in mapping:
        if any(k in text for k in keys):
            academy_fit.append(name)
    score = max(0, min(100, score))
    return {
        "score": score,
        "score_reasons": reasons,
        "region": region,
        "language": "sq" if region in ("kosovo", "albania") else "en",
        "academy_fit": academy_fit[:3],
    }


def run(query: str, slug: str, max_prospects: int) -> int:
    today = date.today().isoformat()
    run_dir = OUTPUT_DIR / f"run-{today}-{slug}"
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "outreach").mkdir(exist_ok=True)

    urls = search_urls(query, limit=max_prospects * 3)
    domain_counts: dict[str, int] = {}
    prospects = []
    scanned = 0

    for url in urls:
        if scanned >= max_prospects * 2:
            break
        domain = urlparse(url).netloc.replace("www.", "")
        if domain_counts.get(domain, 0) >= MAX_SCANS_PER_DOMAIN:
            continue
        domain_counts[domain] = domain_counts.get(domain, 0) + 1
        record = scrape(url)
        scanned += 1
        time.sleep(1.0)
        record["emails"] = [e for e in (record.get("emails") or []) if not is_board_email(e)]
        enriched = score_record(record, query)
        record.update(enriched)
        record["contact_channel"] = (record.get("emails") or [None])[0]
        record["name"] = None
        record["title"] = None
        record["organization"] = domain
        record["notes"] = record.get("error") or ""
        prospects.append(record)

    kept = [p for p in prospects if p.get("score", 0) >= 50]
    kept.sort(key=lambda p: p["score"], reverse=True)
    kept = kept[:max_prospects]

    (run_dir / "prospects.json").write_text(
        json.dumps(kept, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    lines = [
        f"# Prospects — {slug}",
        "",
        f"Query: `{query}`",
        f"Scanned: {scanned} | Kept (score >= 50): {len(kept)}",
        "",
        "| Score | Region | Org | URL | Fit | Reasons | Contact |",
        "|------:|--------|-----|-----|-----|---------|---------|",
    ]
    for p in kept:
        lines.append(
            "| {score} | {region} | {org} | {url} | {fit} | {reasons} | {contact} |".format(
                score=p["score"],
                region=p["region"],
                org=(p.get("organization") or "-").replace("|", "/"),
                url=p["url"],
                fit=", ".join(p.get("academy_fit") or []) or "-",
                reasons="; ".join(p.get("score_reasons") or [])[:120],
                contact=p.get("contact_channel") or "-",
            )
        )
    (run_dir / "prospects.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps({"run_dir": str(run_dir), "scanned": scanned, "kept": len(kept)}, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Public-web prospect discovery")
    sub = parser.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("query")
    s.add_argument("--limit", type=int, default=15)
    r = sub.add_parser("run")
    r.add_argument("--query", required=True)
    r.add_argument("--slug", required=True)
    r.add_argument("--max", type=int, default=15)
    args = parser.parse_args()

    if args.cmd == "search":
        for u in search_urls(args.query, limit=args.limit):
            print(u)
        return 0
    return run(args.query, args.slug, args.max)


if __name__ == "__main__":
    sys.exit(main())
