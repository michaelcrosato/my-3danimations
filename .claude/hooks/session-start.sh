#!/bin/bash
# SessionStart hook (WP-0.5): install the pinned dependencies with `npm ci` and export CHROMIUM_PATH to the
# preinstalled Chromium, so `npm run check`, `npm test` and `npm run e2e` work as soon as a session starts.
# Idempotent and non-interactive. Never runs `playwright install`: the container already has build 1194.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

npm ci --no-audit --no-fund --loglevel=error

chromium=""
for candidate in "${CHROMIUM_PATH:-}" /opt/pw-browsers/chromium-1194/chrome-linux/chrome /opt/pw-browsers/chromium; do
  if [ -n "$candidate" ] && [ -x "$candidate" ] && [ -f "$candidate" ]; then
    chromium="$candidate"
    break
  fi
done

if [ -n "$chromium" ]; then
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export CHROMIUM_PATH=\"$chromium\"" >> "$CLAUDE_ENV_FILE"
  fi
  echo "session-start: npm ci done; CHROMIUM_PATH=$chromium"
else
  echo "session-start: npm ci done; no preinstalled Chromium found (npm run e2e needs one)"
fi
