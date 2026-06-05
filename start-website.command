#!/bin/bash
# Double-click this file on macOS to start the SyllaBee website.
# (.command files open in Terminal.app; .sh files often open in Xcode.)
#
# It installs npm dependencies the first time, starts the Vite dev server,
# and opens the site in your browser. Close the Terminal window (or press
# Ctrl-C) to stop the server.

cd "$(dirname "$0")/web" || {
  echo "Could not find the web/ directory."
  read -r -p "Press Enter to close..."
  exit 1
}

if ! command -v npm >/dev/null 2>&1; then
  echo "npm (Node.js) is not installed. Install it from https://nodejs.org and try again."
  read -r -p "Press Enter to close..."
  exit 1
fi

# Install dependencies on first run.
if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only)..."
  npm install || {
    echo "npm install failed."
    read -r -p "Press Enter to close..."
    exit 1
  }
fi

URL="http://localhost:5173"
echo ""
echo "Starting SyllaBee website at $URL"
echo "Press Ctrl-C to stop the server."
echo ""

# Open the browser shortly after the server boots (runs in the background).
( sleep 3; open "$URL" ) &

npm run dev

echo ""
read -r -p "Server stopped. Press Enter to close this window..."
