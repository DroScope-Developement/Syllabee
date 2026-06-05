#!/bin/bash
# Faster discovery (fewer search hits per query) — 3 PDFs per subject by default.

cd "$(dirname "$0")"
MAX_PER_COURSE="${MAX_PER_COURSE:-3}" bash ./run.sh

echo ""
read -r -p "Press Enter to close this window..."
