#!/usr/bin/env python3
import argparse
import json
import re
import sys
import time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
SKIP_EXT = (".pdf", ".zip", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".mp4", ".css", ".js")


def clean_text(text: str, limit: int = 4000) -> str:
    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    out = "\n".join(lines)
    return out[:limit]


def scrape(url: str, timeout_ms: int = 25000) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return {"url": url, "error": "invalid_url", "blocked": False}
    if url.lower().split("?")[0].endswith(SKIP_EXT):
        return {"url": url, "error": "skipped_extension", "blocked": False}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()
        record = {
            "url": url,
            "blocked": False,
            "error": None,
            "status": None,
            "title": "",
            "meta_description": "",
            "text": "",
            "emails": [],
            "links": [],
        }
        try:
            response = page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")
            record["status"] = response.status if response else None
            body = (response.body() if response else b"") or b""
            head = body[:2000].decode("utf-8", errors="ignore").lower()
            if any(x in head for x in ("captcha", "cf-challenge", "g-recaptcha")):
                record["blocked"] = True
                record["error"] = "captcha"
                browser.close()
                return record
            if response and response.status in (401, 402, 403, 429):
                record["blocked"] = True
                record["error"] = f"http_{response.status}"
            page.wait_for_timeout(1200)
            content = page.content()
            if "sign in" in content.lower()[:3000] and page.locator("form[action*='login']").count() > 0:
                record["blocked"] = True
                record["error"] = "login_wall"
            record["title"] = page.title()
            try:
                record["meta_description"] = page.locator("meta[name=description]").first.get_attribute("content") or ""
            except Exception:
                record["meta_description"] = ""
            record["text"] = clean_text(page.inner_text("body"))
            record["emails"] = sorted(set(EMAIL_RE.findall(content)))
            hrefs = page.eval_on_selector_all(
                "a[href]",
                "els => els.map(e => ({href: e.href, text: (e.innerText||'').trim().slice(0,120)}))",
            )
            seen = set()
            links = []
            for item in hrefs:
                href = item.get("href") or ""
                if not href.startswith("http") or href in seen:
                    continue
                seen.add(href)
                links.append(item)
                if len(links) >= 40:
                    break
            record["links"] = links
        except Exception as exc:
            record["error"] = type(exc).__name__ + ": " + str(exc)[:200]
        finally:
            browser.close()
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape a public web page with Playwright")
    parser.add_argument("url")
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()
    time.sleep(0.3)
    result = scrape(args.url)
    if args.pretty:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(result, ensure_ascii=False))
    return 0 if not result.get("error") or result.get("blocked") else 1


if __name__ == "__main__":
    sys.exit(main())
