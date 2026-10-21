#!/bin/bash
# SessionStart hook (WP-0.5, D79): put the Node that package.json's engines field asks for first on PATH, install the
# pinned dependencies with `npm ci` unless they already are (D121), fetch by hash the rigs and pinned sources the tests and gates read, and export
# CHROMIUM_PATH to the preinstalled Chromium, so `npm run check`, `npm test`, `npm run e2e` and the gates work as soon
# as a session starts. Idempotent and non-interactive. Never runs `playwright install`: the container has build 1194.
set -euo pipefail

# Cloud sessions only: a local checkout installs on its own terms. Set CLAUDE_CODE_REMOTE=true to run it anyway.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# Node: the container's default may be older than the toolchain's (D22: Node 24, CI's 24.21.0) and keeps others as
# /opt/node<major>. The lowest that qualifies (nearest CI's) goes first on PATH, here and for the session. Versions
# compare as major*1000+minor, since the minor counts: every repo CLI runs under `import.meta.main`, new in Node 24.2.
version() { "$1" -p 'const [a, b] = process.versions.node.split("."); a * 1000 + +b' 2>/dev/null || echo 0; }
need=$(node -p 'const m = /(\d+)(?:\.(\d+))?/.exec((require("./package.json").engines || {}).node || "") || [0, 0, 0]; m[1] * 1000 + +(m[2] || 0)' 2>/dev/null || echo 0)
if [ "$(version node)" -lt "$need" ]; then
  while read -r candidate; do
    if [ -x "$candidate" ] && [ "$(version "$candidate")" -ge "$need" ]; then
      bin=$(dirname "$candidate")
      export PATH="$bin:$PATH"
      if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
        echo "export PATH=\"$bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
      fi
      break
    fi
  done < <(printf '%s\n' /opt/node*/bin/node | sort -V)
fi
if [ "$(version node)" -lt "$need" ]; then
  echo "session-start: warning: node $(node --version) is older than package.json's engines (>=$((need / 1000)).$((need % 1000))) and no newer one was found: the repo's CLIs run under import.meta.main, which needs Node 24.2, and do nothing without it"
fi

# npm ci deletes node_modules before it installs, and the hook runs again on every resume, /clear and /compact while
# the m3a MCP server (.mcp.json) starts beside it, its imports gone (CONNECTION_CLOSED, D121). So it runs only when
# node_modules wasn't installed from this package-lock.json and these package.json files (the root's and each
# workspace's: npm ci refuses a lockfile out of step with them, so a change to either installs again) on this Node: a
# stamp records their hash and the Node after a clean install.
stamp=node_modules/.m3a-installed
want="$(node -p 'const fs = require("fs"), h = require("crypto").createHash("sha256"), ws = fs.existsSync("packages") ? fs.readdirSync("packages").sort().map((d) => `packages/${d}/package.json`) : []; for (const f of ["package-lock.json", "package.json", ...ws]) if (fs.existsSync(f)) h.update(`${f}\0`).update(fs.readFileSync(f)); h.digest("hex")') $(node --version)"
if [ -d node_modules ] && [ "$(cat "$stamp" 2>/dev/null)" = "$want" ]; then
  echo "session-start: node_modules already installed from package-lock.json and package.json on $(node --version): npm ci skipped"
else
  npm ci --no-audit --no-fund --loglevel=error
  echo "$want" > "$stamp"
fi

chromium=""
for candidate in "${CHROMIUM_PATH:-}" /opt/pw-browsers/chromium-1194/chrome-linux/chrome /opt/pw-browsers/chromium; do
  if [ -n "$candidate" ] && [ -x "$candidate" ] && [ -f "$candidate" ]; then
    chromium="$candidate"
    break
  fi
done
if [ -n "$chromium" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export CHROMIUM_PATH=\"$chromium\"" >> "$CLAUDE_ENV_FILE"
fi

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

if [ -n "$chromium" ]; then
  echo "session-start: node $(node --version), node_modules ready; CHROMIUM_PATH=$chromium"
else
  echo "session-start: node $(node --version), node_modules ready; no preinstalled Chromium found (npm run e2e needs one)"
fi
