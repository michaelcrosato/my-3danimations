#!/bin/bash
# SessionStart hook (WP-0.5, D79): put the Node that package.json's engines field asks for first on PATH, install the
# pinned dependencies with `npm ci`, fetch by hash the rigs and pinned sources the tests and gates read, and export
# CHROMIUM_PATH to the preinstalled Chromium, so `npm run check`, `npm test`, `npm run e2e` and the gates work as soon
# as a session starts. Idempotent and non-interactive. Never runs `playwright install`: the container has build 1194.
set -euo pipefail

# Cloud sessions only: a local checkout installs on its own terms. Set CLAUDE_CODE_REMOTE=true to run it anyway.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# Node: the container's default may be older than the toolchain's (D22: Node 24, CI's 24.21.0) and keeps others as
# /opt/node<major>. The first that qualifies (the lowest major, nearest CI's) goes first on PATH, here and for the session.
major() { "$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
need=$(node -p 'parseInt(require("./package.json").engines.node.replace(/^\D+/, ""), 10)')
if [ "$(major node)" -lt "$need" ]; then
  for candidate in /opt/node*/bin/node; do
    if [ -x "$candidate" ] && [ "$(major "$candidate")" -ge "$need" ]; then
      bin=$(dirname "$candidate")
      export PATH="$bin:$PATH"
      if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
        echo "export PATH=\"$bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
      fi
      break
    fi
  done
fi
if [ "$(major node)" -lt "$need" ]; then
  echo "session-start: warning: node $(node --version) is older than package.json's engines (>=$need) and no newer one was found"
fi

npm ci --no-audit --no-fund --loglevel=error

# Fixtures by hash, as CI fetches them: the real CC0 rigs (whose tests skip without them), each gate's held-out rigs,
# and the pinned sources (vectors, gates, the carry test). A failed fetch warns instead of failing the session.
fetch() {
  local out
  if out=$("$@" 2>&1); then
    echo "session-start: $(grep -m1 ': PASS' <<<"$out" || echo "$*: done")"
  else
    echo "session-start: warning: $* failed:"
    tail -n 6 <<<"$out"
  fi
}
fetch npm run --silent fixtures -- fetch
for manifest in bench/results/heldout/*/run-*/rig.json; do
  if [ -f "$manifest" ]; then
    fetch npm run --silent fixtures -- fetch --manifest "$manifest"
  fi
done
fetch npm run --silent pins -- fetch

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
  echo "session-start: node $(node --version), npm ci done; CHROMIUM_PATH=$chromium"
else
  echo "session-start: node $(node --version), npm ci done; no preinstalled Chromium found (npm run e2e needs one)"
fi
