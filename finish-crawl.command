#!/bin/bash
# Double-click this file on macOS to finish filling out the syllabus catalog.
# (.command files open in Terminal.app; .sh files often open in Xcode.)
#
# Target: 3 quality syllabi per course. The gap-fill crawler only searches
# courses that are still below the target, so this run focuses entirely on
# the courses we don't have yet (empty + incomplete).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
VENV_DIR="$ROOT/.venv"
MAX_PER_COURSE="${MAX_PER_COURSE:-3}"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "==> Creating virtual environment..."
  "$PYTHON" -m venv "$VENV_DIR"
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

echo "==> Installing dependencies..."
pip install -q -r requirements.txt

echo "==> Initializing catalog (curricula + 74 courses)..."
python syllabee.py init >/dev/null

echo ""
echo "==> Courses still missing syllabi (target: $MAX_PER_COURSE each):"
python syllabee.py gaps --max-per-course "$MAX_PER_COURSE"

echo ""
echo "==> Reorganize loose PDFs + fill gaps ($MAX_PER_COURSE per course, missing courses only)..."
python crawl_syllabi.py \
  --ignore-robots \
  --no-init-data \
  --max-per-course "$MAX_PER_COURSE" \
  --fill-gaps

echo ""
echo "==> Importing any PDFs on disk into catalog..."
python syllabee.py import --no-init-data

echo ""
echo "==> Remaining gaps after this run:"
python syllabee.py gaps --max-per-course "$MAX_PER_COURSE"
python syllabee.py stats

echo ""
echo "Done. PDFs: $ROOT/sylabi/  |  Re-run this file to keep filling gaps."
read -r -p "Press Enter to close this window..."
