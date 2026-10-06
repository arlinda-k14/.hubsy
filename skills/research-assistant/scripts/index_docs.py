#!/usr/bin/env python3
"""Build a read-only SQLite FTS5 index over Creative Hub's internal documents.

Source directory (default ~/.hubsy/docs/internal) is NEVER modified - files are
opened for reading only.

Privacy: placement CSVs are indexed through a strict column whitelist
(program, completion_date, placement_outcome, employer_sector, role_title,
months_to_placement). Every other column (names, emails, phone numbers, IDs)
is discarded at index time. Email address and phone-like patterns are redacted
from all indexed text as a second line of defence.

Usage:
    python3 scripts/index_docs.py [--docs-dir ~/.hubsy/docs/internal] \
        [--db data/index.sqlite] [--rebuild]
"""
import argparse
import csv
import datetime
import json
import os
import re
import sqlite3
import sys

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DOCS_DIR = os.path.expanduser("~/.hubsy/docs/internal")
DEFAULT_DB = os.path.join(SKILL_ROOT, "data", "index.sqlite")

WHITELIST_FIELDS = [
    "program",
    "completion_date",
    "placement_outcome",
    "employer_sector",
    "role_title",
    "months_to_placement",
]

SUPPORTED_TEXT_EXT = {".md", ".markdown", ".txt"}

EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
PHONE_RE = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")
MAX_CHUNK_CHARS = 1500


def log(message):
    sys.stderr.write(message.rstrip() + "\n")


def redact(text):
    """Remove email addresses and phone-like sequences from indexed text."""
    text = EMAIL_RE.sub("[redacted]", text)
    text = PHONE_RE.sub("[redacted]", text)
    return text


def chunk_text(text, max_chars=MAX_CHUNK_CHARS):
    """Split free text into overlapping-free chunks by paragraph, then size."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks, current = [], ""
    for para in paragraphs:
        if len(current) + len(para) + 2 <= max_chars:
            current = (current + "\n\n" + para) if current else para
            continue
        if current:
            chunks.append(current)
        while len(para) > max_chars:  # hard-split oversized paragraphs
            chunks.append(para[:max_chars])
            para = para[max_chars:]
        current = para
    if current:
        chunks.append(current)
    return chunks


def chunk_markdown(text, max_chars=MAX_CHUNK_CHARS):
    """Chunk markdown by headings so chunks keep their section title."""
    sections, heading, buf = [], "", []
    for line in text.splitlines():
        if re.match(r"^#{1,4}\s+", line):
            if buf:
                sections.append((heading, "\n".join(buf).strip()))
            heading, buf = line.lstrip("#").strip(), []
        else:
            buf.append(line)
    if buf:
        sections.append((heading, "\n".join(buf).strip()))

    chunks = []
    for sec_heading, body in sections:
        if not body:
            continue
        for piece in chunk_text(body, max_chars):
            chunks.append((sec_heading or "(no heading)", piece))
    return chunks


def read_csv_rows(path):
    """Return (headers, whitelisted rows). Non-whitelisted columns are dropped."""
    with open(path, "r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        headers = reader.fieldnames or []
        keep = [h for h in headers if h and h.strip().lower() in WHITELIST_FIELDS]
        rows = []
        for row in reader:
            clean = {}
            for header in keep:
                value = (row.get(header) or "").strip()
                clean[header.strip().lower()] = redact(value)
            if any(clean.values()):
                rows.append(clean)
        dropped = [h for h in headers if h not in keep]
        return keep, rows, dropped


def placement_row_text(row):
    return "; ".join("%s: %s" % (k, v) for k, v in row.items() if v)


def main():
    parser = argparse.ArgumentParser(description="Index internal docs into SQLite FTS5")
    parser.add_argument("--docs-dir", default=DEFAULT_DOCS_DIR)
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--rebuild", action="store_true", help="drop and recreate the index")
    args = parser.parse_args()

    docs_dir = os.path.expanduser(args.docs_dir)
    if not os.path.isdir(docs_dir):
        log("INDEX SKIPPED: docs directory not found: %s" % docs_dir)
        log("Create it and drop syllabi/, placements/, employer-feedback/ files in, then re-run.")
        sys.exit(2)

    db_path = args.db if os.path.isabs(args.db) else os.path.join(SKILL_ROOT, args.db)
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    if args.rebuild and os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)")
    conn.execute("""CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY, doc_path TEXT, heading TEXT, chunk TEXT)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS placement_rows (
        doc_path TEXT, program TEXT, completion_date TEXT, placement_outcome TEXT,
        employer_sector TEXT, role_title TEXT, months_to_placement TEXT)""")

    fts = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='chunks_fts'"
    ).fetchone()
    has_fts = True
    if fts is None:
        try:
            conn.execute("""CREATE VIRTUAL TABLE chunks_fts USING fts5(
                chunk, doc_path, heading, tokenize='porter unicode61')""")
        except sqlite3.OperationalError as exc:
            has_fts = False
            log("WARNING: FTS5 unavailable (%s); falling back to LIKE search." % exc)

    # The index is always a full snapshot of the sources (sources stay untouched),
    # so rebuild it from scratch on every run to keep it idempotent.
    conn.execute("DELETE FROM chunks")
    conn.execute("DELETE FROM placement_rows")
    if has_fts:
        conn.execute("DELETE FROM chunks_fts WHERE rowid > 0")
    elif args.rebuild:
        log("Rebuilding without FTS5 (LIKE-search fallback).")

    total_docs = total_chunks = csv_rows = 0
    skipped = []

    for root, dirs, files in os.walk(docs_dir):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for name in sorted(files):
            path = os.path.join(root, name)
            rel = os.path.relpath(path, docs_dir)
            ext = os.path.splitext(name)[1].lower()
            try:
                if ext in SUPPORTED_TEXT_EXT:
                    with open(path, "r", encoding="utf-8", errors="replace") as fh:
                        text = fh.read()
                    pieces = chunk_markdown(text) if ext in (".md", ".markdown") else [
                        ("(document)", c) for c in chunk_text(text)]
                    for heading, body in pieces:
                        body = redact(body)
                        if not body.strip():
                            continue
                        cur = conn.execute(
                            "INSERT INTO chunks (doc_path, heading, chunk) VALUES (?,?,?)",
                            (rel, heading, body))
                        if has_fts:
                            conn.execute(
                                "INSERT INTO chunks_fts(rowid, chunk, doc_path, heading) "
                                "VALUES (?,?,?,?)",
                                (cur.lastrowid, body, rel, heading))
                        total_chunks += 1
                    total_docs += 1
                elif ext == ".csv":
                    keep, rows, dropped = read_csv_rows(path)
                    if not keep:
                        skipped.append("%s (no whitelisted columns)" % rel)
                        continue
                    if dropped:
                        log("PRIVACY: %s - dropped columns: %s" % (rel, ", ".join(dropped)))
                    for row in rows:
                        conn.execute(
                            "INSERT INTO placement_rows (doc_path, program, completion_date, "
                            "placement_outcome, employer_sector, role_title, months_to_placement) "
                            "VALUES (?,?,?,?,?,?,?)",
                            (rel, row.get("program", ""), row.get("completion_date", ""),
                             row.get("placement_outcome", ""), row.get("employer_sector", ""),
                             row.get("role_title", ""), row.get("months_to_placement", "")))
                        body = placement_row_text(row)
                        cur = conn.execute(
                            "INSERT INTO chunks (doc_path, heading, chunk) VALUES (?,?,?)",
                            (rel, "placement record (aggregate-only)", body))
                        if has_fts:
                            conn.execute(
                                "INSERT INTO chunks_fts(rowid, chunk, doc_path, heading) "
                                "VALUES (?,?,?,?)",
                                (cur.lastrowid, body, rel, "placement record (aggregate-only)"))
                        csv_rows += 1
                        total_chunks += 1
                    total_docs += 1
                elif ext == ".json":
                    with open(path, "r", encoding="utf-8", errors="replace") as fh:
                        raw = fh.read()
                    for heading, body in chunk_text(redact(raw)):
                        cur = conn.execute(
                            "INSERT INTO chunks (doc_path, heading, chunk) VALUES (?,?,?)",
                            (rel, "(json)", body))
                        if has_fts:
                            conn.execute(
                                "INSERT INTO chunks_fts(rowid, chunk, doc_path, heading) "
                                "VALUES (?,?,?,?)",
                                (cur.lastrowid, body, rel, "(json)"))
                        total_chunks += 1
                    total_docs += 1
                else:
                    skipped.append("%s (unsupported type %s)" % (rel, ext or "unknown"))
            except (OSError, UnicodeDecodeError, csv.Error, ValueError) as exc:
                skipped.append("%s (error: %s)" % (rel, exc))

    conn.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)",
        ("indexed_at", datetime.datetime.now(datetime.timezone.utc).isoformat()))
    conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)",
                 ("fts_enabled", "1" if has_fts else "0"))
    conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)",
                 ("whitelist", json.dumps(WHITELIST_FIELDS)))
    conn.commit()
    conn.close()

    log("Indexed %d document(s), %d chunk(s), %d placement row(s) -> %s"
        % (total_docs, total_chunks, csv_rows, db_path))
    for item in skipped:
        log("  skipped: %s" % item)
    if total_docs == 0:
        log("No indexable documents found in %s - internal search will return nothing "
            "until syllabi/feedback files are added." % docs_dir)
    sys.exit(0)


if __name__ == "__main__":
    main()
