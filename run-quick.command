#!/bin/bash
# Faster discovery (fewer search hits per query) — still 10 PDFs per subject by default.

cd "$(dirname "$0")"
MAX_PER_COURSE="${MAX_PER_COURSE:-10}" bash ./run.sh

echo ""
read -r -p "Press Enter to close this window..."
