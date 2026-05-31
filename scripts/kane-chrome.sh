#!/usr/bin/env bash
#
# Launch Chrome with remote debugging enabled so Kane Player can attach to it
# over CDP (instead of launching its own browser window).
#
# Usage:
#   ./scripts/kane-chrome.sh
#
# Then in your app's terminal, make sure KANE_CDP_ENDPOINT is set:
#   KANE_CDP_ENDPOINT=http://localhost:9222 npm run dev
#
# Log in once in this Chrome window, navigate to the missions page, and click
# "Play Activity" / "Play Mission". Kane drives THIS window's current tab.

set -euo pipefail

PORT="${KANE_CHROME_PORT:-9222}"

# Use a dedicated profile dir so the debug Chrome doesn't clash with your
# everyday Chrome. Your login persists across runs in this profile.
PROFILE_DIR="${KANE_CHROME_PROFILE:-$HOME/.testmuai/kane-demo-chrome}"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -x "$CHROME" ]; then
  echo "Could not find Google Chrome at: $CHROME" >&2
  echo "Edit scripts/kane-chrome.sh and set the CHROME path for your system." >&2
  exit 1
fi

echo "Launching Chrome with remote debugging on port $PORT"
echo "Profile: $PROFILE_DIR"
echo "Debug endpoint: http://localhost:$PORT"
echo ""
echo "Leave this Chrome open during your demo. Set KANE_CDP_ENDPOINT=http://localhost:$PORT"
echo ""

exec "$CHROME" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  "http://localhost:3000/thinkertools-missions"
