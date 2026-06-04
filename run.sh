#!/usr/bin/env bash
# SyllaBee one-click setup + crawl + catalog import
# Default: up to 10 PDFs per subject/course (no global cap).
# Override: MAX_PER_COURSE=20 ./run.sh

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

echo "==> Initializing catalog (10 curricula)..."
python syllabee.py init

echo ""
echo "==> Degree programs loaded:"
python syllabee.py curricula

echo ""
echo "==> Crawling (up to $MAX_PER_COURSE PDFs per subject/course)..."
python crawl_syllabi.py --ignore-robots --no-init-data --max-per-course "$MAX_PER_COURSE"

echo ""
echo "==> Importing any PDFs on disk into catalog..."
python syllabee.py import --no-init-data

echo ""
echo "==> Catalog summary:"
python syllabee.py stats

echo ""
echo "Done. PDFs: $ROOT/sylabi/  |  Database: $ROOT/data/syllabee.db"
echo "Examples:"
echo "  python syllabee.py curriculum software-engineering-bs"
echo "  python syllabee.py overlap computer-science data-science"
