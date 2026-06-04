#!/bin/bash
# Double-click this file on macOS — opens Terminal (not Xcode).
# .sh files are often bound to Xcode; .command files run in Terminal.app.

cd "$(dirname "$0")"
bash ./run.sh "$@"

echo ""
read -r -p "Press Enter to close this window..."
