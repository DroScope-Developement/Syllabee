#!/usr/bin/env bash
# SyllaBee: fill each catalog course up to MAX_PER_COURSE syllabi (default 10).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
VENV_DIR="$ROOT/.venv"
MAX_PER_COURSE="${MAX_PER_COURSE:-10}"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "==> Creating virtual environment..."
  "$PYTHON" -m venv "$VENV_DIR"
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

echo "==> Installing dependencies..."
pip install -q -r requirements.txt

echo "==> Initializing catalog (10 curricula, 74 courses)..."
python syllabee.py init

echo ""
python syllabee.py gaps --max-per-course "$MAX_PER_COURSE" | head -20
echo "   ... (run: python syllabee.py gaps)"

echo ""
echo "==> Reorganize loose PDFs + fill gaps ($MAX_PER_COURSE per course)..."
python crawl_syllabi.py --ignore-robots --no-init-data --max-per-course "$MAX_PER_COURSE" --fill-gaps

echo ""
echo "==> Importing any PDFs on disk into catalog..."
python syllabee.py import --no-init-data

echo ""
python syllabee.py gaps --max-per-course "$MAX_PER_COURSE" | tail -5
python syllabee.py stats

echo ""
echo "Done. PDFs: $ROOT/sylabi/  |  python syllabee.py gaps"
