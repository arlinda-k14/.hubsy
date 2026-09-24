#!/bin/zsh
# Queue run every 6 hours: re-score/re-stage the most recent raw fetch, re-emit
# output files, and merge dedup/duplicate contacts. Safe to run repeatedly;
# the 90-day dedup set drops already-staged contacts.
set -u
SKILL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SKILL_ROOT"

LOG_DIR="$SKILL_ROOT/logs"
mkdir -p "$LOG_DIR"

$SKILL_ROOT/scripts/score_and_filter.py \
  --in "$SKILL_ROOT"/data/raw_*.json \
  --db "$SKILL_ROOT/data/dedup_cache.sqlite" \
  --min-score 70 \
  >> "$LOG_DIR/queue.log" 2>&1 || echo "queue score_and_filter failed" >> "$LOG_DIR/queue.log"

echo "run_queue completed at $(date)" >> "$LOG_DIR/queue.log"