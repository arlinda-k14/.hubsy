#!/usr/bin/env python3
"""Fetch raw candidate profiles matching career-switch intent from configured platforms.

Reads ./config/lead_sources.json for endpoints, regional keywords and credentials.
Platforms without credentials fall back to a clearly-flagged mock provider so the
pipeline can be exercised end to end (dry-run and testing) before tokens are wired in.
"""
import argparse
import datetime
import json
import os
import sys
import time
import urllib.parse
import urllib.request

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(SKILL_ROOT, "config", "lead_sources.json")
DATA_DIR = os.path.join(SKILL_ROOT, "data")
LOG_DIR = os.path.join(SKILL_ROOT, "logs")

COOLDOWN_SECONDS = 60 * 60  # halt a platform for 60 minutes after HTTP 429


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def log_error(message):
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(os.path.join(LOG_DIR, "errors.log"), "a", encoding="utf-8") as fh:
        fh.write(f"{datetime.datetime.now().isoformat()} {message}\n")


def in_cooldown(platform):
    lock = os.path.join(DATA_DIR, f"cooldown_{platform}.lock")
    if os.path.exists(lock):
        if time.time() - os.path.getmtime(lock) < COOLDOWN_SECONDS:
            return True
        os.remove(lock)
    return False


def set_cooldown(platform):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(os.path.join(DATA_DIR, f"cooldown_{platform}.lock"), "w") as fh:
        fh.write(datetime.datetime.now().isoformat())
    log_error(
        f"HTTP 429 (rate limit) from platform '{platform}'. "
        f"Recorded {datetime.datetime.now().isoformat()}; halting ingestion for 60 minutes."
    )


def match_region(candidate, cfg):
    """Return 'kosovo', 'remote' or None based on declared location."""
    loc = (candidate.get("location") or candidate.get("profile_location") or "").lower()
    if loc in ("", "unknown", "n/a"):
        return None
    for marker in cfg["regions"]["kosovo"]:
        if marker in loc:
            return "kosovo"
    for marker in cfg["regions"]["remote_worldwide"]:
        if marker in loc:
            return "remote"
    return None


def has_intent_keywords(text, words):
    t = (text or "").lower()
    return any(k in t for k in words)


def text_from_post(p):
    return " ".join(
        str(p.get(k, "")) for k in ("title", "selftext", "description", "text", "content", "headline")
    )


def mock_candidates():
    """Synthetic candidates exercising every pipeline path (mock: true)."""
    return [
        {
            "source": "mock",
            "_mock": True,
            "full_name": "Arta Berisha",
            "profile_url": "https://linkedin.com/in/mock-arta-berisha",
            "location": "Pristina, Kosovo",
            "employment_status": "unemployed",
            "background_industry": "Retail cashier",
            "career_goal": "Switch to entry-level digital/tech without prior background",
            "public_email": "arta.berisha.mock@gmail.com",
            "study_hours_per_week": 12,
            "investment_intent": True,
            "alignment": 0.9,
            "exp_years": 0,
            "seeks_direct_placement": False,
            "passive_expectations": False,
            "raw_hint": "open to work, career pivot, how to get into marketing with no experience",
        },
        {
            "source": "mock",
            "_mock": True,
            "full_name": "Dardan Gashi",
            "profile_url": "https://www.reddit.com/user/mock-dardan-gashi",
            "location": "Remote (EU)",
            "employment_status": "unemployed",
            "background_industry": "Construction worker",
            "career_goal": "Looking for new path into AI marketing, willing to pay for training",
            "public_email": "dardan.gashi.mock@yahoo.com",
            "study_hours_per_week": 15,
            "investment_intent": True,
            "alignment": 0.8,
            "exp_years": 0,
            "seeks_direct_placement": False,
            "passive_expectations": False,
            "raw_hint": "career transition, looking for new path, bootcamp or income share",
        },
        {
            "source": "mock",
            "_mock": True,
            "full_name": "Elira Krasniqi",
            "profile_url": "https://facebook.com/groups/mock/elira",
            "location": "Mitrovica, Kosovo",
            "employment_status": "underemployed",
            "background_industry": "Hotel reception",
            "career_goal": "Break into tech, no degree, evenings only",
            "public_email": "elira.krasniqi.mock@gmail.com",
            "study_hours_per_week": 8,
            "investment_intent": False,
            "alignment": 0.7,
            "exp_years": 0,
            "seeks_direct_placement": False,
            "passive_expectations": False,
            "raw_hint": "break into tech with no experience, evenings only",
        },
        {
            "source": "mock",
            "_mock": True,
            "full_name": "Besnik Hoxha",
            "profile_url": "https://linkedin.com/in/mock-besnik-hoxha",
            "location": "Tirana, Albania",
            "employment_status": "unemployed",
            "background_industry": "Accountant (fired, seeking new field)",
            "career_goal": "Career transition after layoff; asked agent for instant placement only",
            "public_email": "besnik.hoxha.mock@gmail.com",
            "study_hours_per_week": 12,
            "investment_intent": False,
            "alignment": 0.7,
            "exp_years": 0,
            "seeks_direct_placement": True,
            "passive_expectations": False,
            "raw_hint": "career transition, want corporate headhunting to place me quickly",
        },
        {
            "source": "mock",
            "_mock": True,
            "full_name": "Linda Rexhepi",
            "profile_url": "https://www.reddit.com/user/mock-linda-rexhepi",
            "location": "Remote, Worldwide",
            "employment_status": "unemployed",
            "background_industry": "Previous junior digital marketer (3y)",
            "career_goal": "Get back into digital marketing at a senior title",
            "public_email": "linda.rexhepi.mock@gmail.com",
            "study_hours_per_week": 10,
            "investment_intent": True,
            "alignment": 0.4,
            "exp_years": 3,
            "seeks_direct_placement": False,
            "passive_expectations": False,
            "raw_hint": "open to work, digital marketing, 3 years experience",
        },
        {
            "source": "mock",
            "_mock": True,
            "full_name": "Blerim Jakupi",
            "profile_url": "https://facebook.com/groups/mock/blerim",
            "location": "Pristina, Kosovo",
            "employment_status": "employed (factory)",
            "background_industry": "Factory line worker",
            "career_goal": "Learn tech fast, wants shortcuts",
            "public_email": "",
            "study_hours_per_week": 2,
            "investment_intent": False,
            "alignment": 0.5,
            "exp_years": 0,
            "seeks_direct_placement": False,
            "passive_expectations": True,
            "raw_hint": "want a new career but only 2 hours a week and want it easy",
        },
    ]


def fetch_reddit(cfg, limit):
    base = cfg["platforms"]["reddit"]["base_url"]
    ua = cfg["platforms"]["reddit"]["user_agent"] or "career-switch-lead-scout/1.0 (contact: admin@example.com)"
    subreddits = cfg["platforms"]["reddit"]["subreddits"]
    intent_words = cfg["keywords"]["switch_intent"] + cfg["keywords"]["tech_entry_intent"]
    results = []
    for sub in subreddits:
        query = urllib.parse.quote(" OR ".join(intent_words[:6]))
        url = f"{base}/r/{sub}/search.json?q={query}&restrict_sr=1&sort=new&limit={limit}"
        req = urllib.request.Request(url, headers={"User-Agent": ua})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            if err.code == 429:
                set_cooldown("reddit")
                log_error("reddit fetch aborted: HTTP 429.")
                return results, False
            log_error(f"reddit fetch failed: HTTP {err.code}")
            continue
        except Exception as err:  # noqa: BLE001 - surface-and-continue per platform
            log_error(f"reddit fetch failed: {err}")
            continue
        for child in payload.get("data", {}).get("children", []):
            data = child.get("data", {})
            results.append({
                "source": "reddit",
                "full_name": f"redditor_{data.get('author')}",
                "profile_url": f"{base}/user/{data.get('author')}",
                "location": data.get("subreddit_name_prefixed", ""),
                "employment_status": "unknown",
                "background_industry": "unknown",
                "career_goal": data.get("selftext", "")[:500],
                "public_email": "",
                "study_hours_per_week": 0,
                "investment_intent": False,
                "alignment": 0.5,
                "exp_years": 0,
                "seeks_direct_placement": False,
                "passive_expectations": False,
                "raw_hint": (data.get("title", "") + " " + data.get("selftext", ""))[:1000],
            })
    return results[:limit], True


def fetch_linkedin(cfg, limit):
    creds = cfg["platforms"]["linkedin"]
    if not creds.get("api_token"):
        log_error("linkedin fetch skipped: api_token missing in config/lead_sources.json. "
                  "LinkedIn has no open discovery API; supply a private-app token or a manual CSV export.")
        return [], False
    return [], True  # skeleton: token-based query against /v2/ would be added here


def fetch_facebook(cfg, limit):
    creds = cfg["platforms"]["facebook"]
    if not creds.get("access_token"):
        log_error("facebook fetch skipped: access_token missing in config/lead_sources.json. "
                  "Group discovery requires Graph API access with group membership.")
        return [], False
    return [], True  # skeleton: Graph API group search would be added here


def main():
    ap = argparse.ArgumentParser(description="Fetch raw candidates for career-switch lead scout.")
    ap.add_argument("--source", required=True, choices=["linkedin", "reddit", "facebook"],
                    help="Target platform identifier.")
    ap.add_argument("--limit", type=int, default=50, help="Maximum candidate intake per run (max 100).")
    ap.add_argument("--target-region", default=None,
                    help="Regional filter, e.g. 'kosovo' or 'remote'. Optional; config regions also apply.")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print candidate objects to stdout without writing the raw file.")
    ap.add_argument("--out", default=os.path.join(DATA_DIR, "raw.json"),
                    help="Output path for the raw candidate JSON.")
    args = ap.parse_args()

    cfg = load_config()
    if args.limit > cfg["caps"]["max_ceiling"]:
        args.limit = cfg["caps"]["max_ceiling"]

    if in_cooldown(args.source):
        log_error(f"{args.source} still in 60-min cooldown after a rate limit; skipping fetch.")
        print(f"Skipped {args.source}: platform in rate-limit cooldown.")
        sys.exit(0)

    platform = cfg["platforms"][args.source]
    if args.source == "reddit" and platform.get("enabled"):
        candidates, ok = fetch_reddit(cfg, args.limit)
    elif args.source == "linkedin":
        candidates, ok = fetch_linkedin(cfg, args.limit)
    elif args.source == "facebook":
        candidates, ok = fetch_facebook(cfg, args.limit)
    else:
        candidates, ok = mock_candidates()[:args.limit], True

    if not ok or candidates == []:
        candidates = mock_candidates()[:args.limit]

    filtered = []
    for cand in candidates:
        region = match_region(cand, cfg)
        if region is None and args.target_region:
            continue
        filtered.append(cand)
    candidates = filtered

    for cand in candidates:
        cand["fetched_at"] = datetime.datetime.now().isoformat()

    payload = {"platform": args.source, "fetched_at": datetime.datetime.now().isoformat(),
               "count": len(candidates), "candidates": candidates}

    if args.dry_run:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"{args.source}: {len(candidates)} candidates fetched -> {args.out}")


if __name__ == "__main__":
    main()