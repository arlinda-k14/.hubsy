#!/usr/bin/env python3
"""Query the internal SQLite index built by index_docs.py.

Privacy: placement data is only ever returned in aggregate via
--placement-summary (counts, rates, medians). Row-level placement chunks are
searchable like any other document chunk, but reports must cite them only as
aggregates - never individual records, never student names.

Usage:
    python3 scripts/query_index.py --query "vibe coding syllabus" --limit 8
    python3 scripts/query_index.py --placement-summary
"""
import argparse
import json
import os
import sqlite3
import statistics
import sys

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB = os.path.join(SKILL_ROOT, "data", "index.sqlite")


def log(message):
    sys.stderr.write(message.rstrip() + "\n")


def sanitize_fts_query(raw):
    """Turn free text into a safe FTS5 OR-query of quoted terms."""
    terms = []
    for token in raw.replace('"', " ").split():
        cleaned = "".join(ch for ch in token if ch.isalnum() or ch in ("-", "_", "+", "."))
        if len(cleaned) >= 2 and cleaned.lower() not in terms:
            terms.append(cleaned.lower())
    return " OR ".join('"%s"' % t for t in terms[:24])


def has_fts(conn):
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='chunks_fts'"
    ).fetchone() is not None


def search(conn, query, limit, fts):
    fts_query = sanitize_fts_query(query)
    if not fts_query:
        return [], "empty query"
    if fts:
        rows = conn.execute(
            """SELECT doc_path, heading, chunk,
                      snippet(chunks_fts, 0, '[', ']', '...', 14) AS snip
               FROM chunks_fts WHERE chunks_fts MATCH ?
               ORDER BY rank LIMIT ?""", (fts_query, limit)).fetchall()
        return [{"doc_path": r[0], "heading": r[1], "snippet": r[3]} for r in rows], fts_query
    rows = conn.execute(
        """SELECT doc_path, heading, chunk FROM chunks
           WHERE lower(chunk) LIKE ? OR lower(heading) LIKE ?
           LIMIT ?""", ("%" + query.lower() + "%", "%" + query.lower() + "%", limit)).fetchall()
    return [{"doc_path": r[0], "heading": r[1], "snippet": r[2][:300]} for r in rows], fts_query


def placement_summary(conn):
    """Aggregate-only view of placement data: no row-level records leave here."""
    rows = conn.execute(
        """SELECT program, placement_outcome, months_to_placement,
                  employer_sector, role_title FROM placement_rows""").fetchall()
    if not rows:
        return {"available": False,
                "note": "No placement rows in the index. Run index_docs.py on "
                        "docs/internal/placements/ first."}
    by_program = {}
    months = []
    sectors, roles = {}, {}
    for program, outcome, m, sector, role in rows:
        program = program or "(unspecified)"
        placed = (outcome or "").strip().lower() in ("placed", "yes", "true", "1", "employed")
        entry = by_program.setdefault(program, {"records": 0, "placed": 0})
        entry["records"] += 1
        entry["placed"] += 1 if placed else 0
        try:
            months.append(float(str(m).strip()))
        except (TypeError, ValueError):
            pass
        if sector:
            sectors[sector] = sectors.get(sector, 0) + 1
        if role:
            roles[role] = roles.get(role, 0) + 1

    for entry in by_program.values():
        entry["placement_rate"] = round(entry["placed"] / entry["records"], 3) \
            if entry["records"] else None
    total = len(rows)
    placed_total = sum(e["placed"] for e in by_program.values())
    summary = {
        "available": True,
        "records": total,
        "placement_rate": round(placed_total / total, 3) if total else None,
        "by_program": by_program,
        "top_employer_sectors": sorted(sectors.items(), key=lambda kv: -kv[1])[:8],
        "top_role_titles": sorted(roles.items(), key=lambda kv: -kv[1])[:8],
    }
    if months:
        summary["months_to_placement_median"] = round(statistics.median(months), 1)
        summary["months_to_placement_note"] = "median of %d records" % len(months)
    return summary


def main():
    parser = argparse.ArgumentParser(description="Query the internal document index")
    parser.add_argument("--query", default=None)
    parser.add_argument("--limit", type=int, default=8)
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--json", action="store_true", help="emit JSON instead of text")
    parser.add_argument("--placement-summary", action="store_true",
                        help="print aggregate placement statistics only (privacy-safe)")
    args = parser.parse_args()

    db_path = args.db if os.path.isabs(args.db) else os.path.join(SKILL_ROOT, args.db)
    if not os.path.exists(db_path):
        log("Internal index not found at %s." % db_path)
        log("Run: python3 scripts/index_docs.py  (then re-run this query)")
        sys.exit(2)

    conn = sqlite3.connect(db_path)

    if args.placement_summary:
        result = placement_summary(conn)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        conn.close()
        sys.exit(0 if result.get("available") else 4)

    if not args.query:
        log("Provide --query or --placement-summary.")
        sys.exit(2)

    fts = has_fts(conn)
    results, executed = search(conn, args.query, args.limit, fts)
    indexed_at = conn.execute(
        "SELECT value FROM meta WHERE key='indexed_at'").fetchone()
    conn.close()

    payload = {
        "query": args.query,
        "fts_query": executed if fts else "LIKE fallback",
        "indexed_at": indexed_at[0] if indexed_at else None,
        "result_count": len(results),
        "results": results,
    }
    if args.json or not results:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        for i, item in enumerate(results, 1):
            print("%d. %s :: %s\n   %s\n" % (i, item["doc_path"], item["heading"],
                                             item["snippet"].replace("\n", " ")))
    if not results:
        log("No internal matches for '%s'. If documents were added since the last index, "
            "run: python3 scripts/index_docs.py" % args.query)
    sys.exit(0)


if __name__ == "__main__":
    main()
