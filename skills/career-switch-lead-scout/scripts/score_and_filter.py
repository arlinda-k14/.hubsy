#!/usr/bin/env python3
"""Score, filter, dedup and stage qualified leads for human review.

Reads:    ./data/raw_*.json (candidate payloads) and ./config/lead_sources.json
Reads/Writes: ./data/dedup_cache.sqlite (90-day URL/email hash dedup + per-platform daily intake slots)
Writes:   ./output/staged_leads_<date>.csv (+ .pdf when a renderer is available)
Errors:   ./logs/errors.log ; ./data/failed_sync_<timestamp>.csv on export failure (exit 1)
"""
import argparse
import csv
import datetime
import hashlib
import json
import os
import sqlite3
import sys

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(SKILL_ROOT, "config", "lead_sources.json")
DATA_DIR = os.path.join(SKILL_ROOT, "data")
OUTPUT_DIR = os.path.join(SKILL_ROOT, "output")
LOG_DIR = os.path.join(SKILL_ROOT, "logs")

OUTPUT_COLUMNS = [
    "full_name",
    "profile_url",
    "location",
    "detected_status",
    "background_industry",
    "commitment_hours",
    "score",
    "language",
    "draft_outreach_message",
    "source",
    "public_email",
    "career_goal",
    "disqualification_reason",
]


def today():
    return datetime.date.today().isoformat()


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def log_error(message):
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(os.path.join(LOG_DIR, "errors.log"), "a", encoding="utf-8") as fh:
        fh.write(f"{datetime.datetime.now().isoformat()} {message}\n")


def email_hash(email):
    if not email:
        return None
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


def connect_db(path):
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS seen_contacts ("
        " profile_url TEXT PRIMARY KEY, email_hash TEXT, first_seen TEXT )"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS intake_slots ("
        " date TEXT, platform TEXT, count INTEGER, PRIMARY KEY(date, platform) )"
    )
    conn.commit()
    return conn


def build_dedup_set(conn, window_days):
    cutoff = (datetime.date.today() - datetime.timedelta(days=window_days)).isoformat()
    seen_urls, seen_emails = set(), set()
    for row in conn.execute(
        "SELECT profile_url, email_hash FROM seen_contacts WHERE first_seen >= ?", (cutoff,)
    ):
        seen_urls.add(row[0])
        if row[1]:
            seen_emails.add(row[1])
    return seen_urls, seen_emails


def is_duplicate(seen_urls, seen_emails, cand):
    if cand.get("profile_url") and cand["profile_url"] in seen_urls:
        return True
    eh = email_hash(cand.get("public_email"))
    return bool(eh and eh in seen_emails)


def record_contact(conn, cand):
    conn.execute(
        "INSERT OR REPLACE INTO seen_contacts (profile_url, email_hash, first_seen) VALUES (?, ?, ?)",
        (cand.get("profile_url") or "", email_hash(cand.get("public_email")), today()),
    )


def disqualification_reasons(cand, cfg):
    q = cfg["qualification"]
    reasons = []
    industry = (cand.get("background_industry") or cand.get("previous_industry") or "").lower()
    years = float(cand.get("exp_years") or 0)
    if years > q["max_exp_years"] and any(
        bad in industry for bad in q["disqualifying_industries"]
    ):
        reasons.append(f"exceeds {q['max_exp_years']}y direct experience in {industry}")
    if cand.get("seeks_direct_placement"):
        reasons.append("demands immediate corporate headhunting placement over training")
    hours = cand.get("study_hours_per_week", 0) or 0
    floor = cfg["scoring"]["study_target"]["hard_floor_hours"]
    if hours < floor:
        reasons.append(f"study availability {hours}h/wk below {floor}h/wk minimum")
    if cand.get("passive_expectations"):
        reasons.append("seeking passive results rather than active study")
    return reasons


def score_candidate(cand, cfg):
    w = cfg["scoring"]["weights"]
    target = cfg["scoring"]["study_target"]
    hours = cand.get("study_hours_per_week", 0) or 0
    if hours >= target["qualified_hours"]:
        study = 100.0
    elif hours >= target["hard_floor_hours"]:
        study = 100.0 * hours / target["qualified_hours"]
    else:
        study = 0.0
    investment = 100.0 if cand.get("investment_intent") else 40.0
    alignment = 100.0 * float(cand.get("alignment", 0.5))
    total = w["study_commitment"] * study + w["investment_intent"] * investment + w["role_alignment"] * alignment
    return round(total), round(study), round(investment), round(alignment)


def infer_region_label(cand, cfg):
    loc = (cand.get("location") or "").lower()
    if any(m in loc for m in cfg["regions"]["kosovo"]) or "albani" in loc:
        return "kosovo"
    return "remote"


def suggest_role(cand, cfg):
    roles = cfg["qualification"]["target_roles"]
    text = (cand.get("background_industry") or cand.get("career_goal") or "").lower()
    if "write" in text or "copy" in text:
        return roles[-1]
    if "content" in text or "ops" in text or "operation" in text:
        return roles[1]
    if "market" in text or "digital" in text:
        return roles[2]
    return roles[0]


def draft_outreach(cand, cfg):
    first = (cand.get("full_name") or "there").strip().split()[0]
    role = suggest_role(cand, cfg)
    offer = cfg["offer"]
    upfront = offer["tuition_upfront"]
    inst = offer["installments"]
    inst_total = inst["count"] * inst["amount"]
    region = infer_region_label(cand, cfg)
    if region == "kosovo":
        return (
            f"Përshëndetje {first},\n\n"
            f"E pashë që po kërkon rrugë të re drejt një karriere dixhitale pa përvojë të mëparshme. "
            f"Programi ynë të çon drejt rolit {role}.\n\n"
            f"Pa kodim - kurrikula është në gjuhë të thjeshtë, me mjete praktike dhe udhëzime hap pas hapi "
            f"për fillestarë. Opsione financimi: {upfront}$ kësti i plotë ose {inst['count']} këste nga {inst['amount']}$ "
            f"({inst_total}$ në total).\n\n"
            f"Nëse dëshiron, unë mund të t'i tregoj më shumë detaje dhe si t'i bësh hapat e parë. "
            f"Përshëndetje, Ekipi i Trajnimit"
        )
    return (
        f"Hi {first},\n\n"
        f"I noticed you are exploring a fresh path into a digital career with no prior background. "
        f"Our training program is built for exactly that transition and points toward the {role} role.\n\n"
        f"There is zero coding involved - the curriculum runs on plain-English prompts, everyday practical "
        f"tools, and step-by-step beginner guidance. Tuition options are an upfront {upfront}$ or "
        f"{inst['count']} installments of {inst['amount']}$ ({inst_total}$ total).\n\n"
        f"Happy to share more detail on the program and your first steps. Thanks!"
    )


def ceiling_remaining(conn, platform, cfg):
    ceiling = cfg["caps"]["daily_ceiling_per_platform"]
    row = conn.execute(
        "SELECT count FROM intake_slots WHERE date=? AND platform=?", (today(), platform)
    ).fetchone()
    used = row[0] if row else 0
    return max(0, ceiling - used)


def claim_slots(conn, platform, n):
    conn.execute(
        "INSERT INTO intake_slots (date, platform, count) VALUES (?, ?, ?) "
        "ON CONFLICT(date, platform) DO UPDATE SET count = count + excluded.count",
        (today(), platform, n),
    )


def write_output(path, records):
    if not records:
        return
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=OUTPUT_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)


def write_pdf(path, records):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    except ImportError:
        log_error("PDF export skipped: reportlab not installed. CSV remains available.")
        return False
    doc = SimpleDocTemplate(path, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [Paragraph(f"Staged Leads - {today()}", styles["Title"]), Spacer(1, 12)]
    for rec in records:
        elements.append(Paragraph(
            f"<b>{rec.get('full_name')}</b> | Score {rec.get('score')}/100 | {rec.get('location')} | {rec.get('language')}",
            styles["Heading3"]))
        elements.append(Paragraph(rec.get("profile_url", ""), styles["BodyText"]))
        elements.append(Paragraph("Detected status: " + rec.get("detected_status", ""), styles["BodyText"]))
        elements.append(Paragraph("Industry: " + rec.get("background_industry", ""), styles["BodyText"]))
        elements.append(Paragraph("Commitment: " + str(rec.get("commitment_hours", "")), styles["BodyText"]))
        elements.append(Paragraph("Outreach: " + rec.get("draft_outreach_message", ""), styles["BodyText"]))
        elements.append(Spacer(1, 12))
    doc.build(elements)
    return True


def load_candidates(paths):
    out = []
    for path in paths:
        with open(path, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
        if isinstance(payload, dict) and "candidates" in payload:
            out.extend(payload["candidates"])
        elif isinstance(payload, list):
            out.extend(payload)
    return out


def main():
    ap = argparse.ArgumentParser(description="Score/filter/stage candidates for career-switch lead scout.")
    ap.add_argument("--in", dest="inputs", nargs="+", required=True, help="Raw candidate JSON file(s).")
    ap.add_argument("--db", default=os.path.join(DATA_DIR, "dedup_cache.sqlite"),
                    help="SQLite dedup cache path.")
    ap.add_argument("--min-score", type=int, default=70, help="Qualification threshold (default 70).")
    ap.add_argument("--out", default=None, help="CSV output path (default output/staged_leads_<date>.csv).")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print the staged record set without writing DB or output files.")
    args = ap.parse_args()

    cfg = load_config()
    records = []
    disqualified = []

    try:
        conn = None
        if not args.dry_run:
            os.makedirs(os.path.dirname(os.path.abspath(args.db)) or ".", exist_ok=True)
            conn = connect_db(args.db)
            seen_urls, seen_emails = build_dedup_set(conn, cfg["dedup"]["window_days"])

        for cand in load_candidates(args.inputs):
            platform = cand.get("source", "unknown")

            reasons = disqualification_reasons(cand, cfg)
            if reasons:
                disqualified.append({**cand, "disqualification_reason": "; ".join(reasons)})
                continue

            if conn and is_duplicate(seen_urls, seen_emails, cand):
                log_error(f"dedup: dropped {cand.get('profile_url')} (seen within {cfg['dedup']['window_days']} days).")
                continue

            if conn and ceiling_remaining(conn, platform, cfg) <= 0:
                log_error(f"intake ceiling reached for platform={platform} on {today()}; skipping {cand.get('profile_url')}.")
                continue

            score, _, _, _ = score_candidate(cand, cfg)
            language = "Albanian" if infer_region_label(cand, cfg) == "kosovo" else "English"

            row = {
                "full_name": cand.get("full_name", ""),
                "profile_url": cand.get("profile_url", ""),
                "location": cand.get("location", ""),
                "detected_status": cand.get("employment_status", ""),
                "background_industry": cand.get("background_industry") or cand.get("previous_industry", ""),
                "commitment_hours": cand.get("study_hours_per_week", 0),
                "score": score,
                "language": language,
                "draft_outreach_message": draft_outreach(cand, cfg) if score >= args.min_score else "",
                "source": platform,
                "public_email": cand.get("public_email", ""),
                "career_goal": cand.get("career_goal", ""),
                "disqualification_reason": "",
            }
            records.append(row)
            if conn:
                record_contact(conn, cand)
                claim_slots(conn, platform, 1)
    except sqlite3.Error as err:
        log_error(f"database error: {err}")
        if records:
            ts = datetime.datetime.now().strftime("%Y%m%dT%H%M%S")
            fallback = os.path.join(DATA_DIR, f"failed_sync_{ts}.csv")
            write_output(fallback, records)
            print(f"Database error; {len(records)} records saved to {fallback}.")
        sys.exit(1)

    if conn:
        conn.commit()
        conn.close()

    if args.dry_run:
        print(json.dumps(records, indent=2, ensure_ascii=False))
        return

    qualified = [r for r in records if r["score"] >= args.min_score and r["draft_outreach_message"]]
    if args.out is None:
        args.out = os.path.join(OUTPUT_DIR, f"staged_leads_{today()}.csv")
    try:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
        write_output(args.out, qualified)
    except OSError as err:
        ts = datetime.datetime.now().strftime("%Y%m%dT%H%M%S")
        fallback = os.path.join(DATA_DIR, f"failed_sync_{ts}.csv")
        write_output(fallback, qualified)
        log_error(f"output write failed: {err}; records saved to {fallback}.")
        print(f"Export failed -> {fallback}; archived as failed_sync.")
        sys.exit(1)

    pdf_path = args.out.replace(".csv", ".pdf")
    write_pdf(pdf_path, qualified)

    print(json.dumps({
        "fetched_total": len(records) + len(disqualified),
        "disqualified": len(disqualified),
        "staged_qualified": len(qualified),
        "output_csv": args.out,
        "output_pdf": pdf_path if os.path.exists(pdf_path) else None,
        "disqualified_records": disqualified,
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()