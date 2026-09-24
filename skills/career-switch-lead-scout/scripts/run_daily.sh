#!/bin/zsh
# Daily 07:00 intake run: fetch all configured platforms, then score/filter/stage.
set -u
SKILL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SKILL_ROOT"

LOG_DIR="$SKILL_ROOT/logs"
mkdir -p "$LOG_DIR"

STAMP="$(date +%Y%m%d)"
RAW_DIR="$SKILL_ROOT/data"

for platform in linkedin reddit facebook; do
  $SKILL_ROOT/scripts/fetch_candidates.py \
    --source "$platform" \
    --limit 100 \
    --out "$RAW_DIR/raw_${platform}_${STAMP}.json" \
    >> "$LOG_DIR/cron.log" 2>&1 || echo "fetch_$platform failed" >> "$LOG_DIR/cron.log"
done

$SKILL_ROOT/scripts/score_and_filter.py \
  --in "$RAW_DIR"/raw_*_${STAMP}.json \
  --db "$RAW_DIR/dedup_cache.sqlite" \
  --min-score 70 \
  >> "$LOG_DIR/cron.log" 2>&1 || echo "score_and_filter failed" >> "$LOG_DIR/cron.log"

echo "run_daily completed at $(date)" >> "$LOG_DIR/cron.log"