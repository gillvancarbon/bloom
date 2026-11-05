#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Bloom · Habit Tracker — development mode
#  Runs Spring Boot (:8080) + Vite (:5173) with hot reload.
#  Usage:  ./dev.sh
# ─────────────────────────────────────────────────────────────
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Locate a JDK 21+ ─────────────────────────────────────────
find_java() {
  if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    echo "$JAVA_HOME"
  elif command -v java >/dev/null 2>&1; then
    local bin
    bin="$(dirname "$(readlink -f "$(command -v java)")")"
    echo "$(dirname "$bin")"
  elif [ -x /tmp/opencode/jdk-21.0.13+9/bin/java ]; then
    echo /tmp/opencode/jdk-21.0.13+9
  fi
}
JAVA_HOME="$(find_java)"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

# ── Node ─────────────────────────────────────────────────────
if ! command -v npm >/dev/null 2>&1 && [ -x /tmp/opencode/node/bin/npm ]; then
  export PATH="/tmp/opencode/node/bin:$PATH"
fi

# ── Maven ────────────────────────────────────────────────────
if [ -x "$DIR/backend/mvnw" ]; then MVN="$DIR/backend/mvnw"
elif command -v mvn >/dev/null 2>&1; then MVN="mvn"
elif [ -x /tmp/opencode/maven/bin/mvn ]; then MVN=/tmp/opencode/maven/bin/mvn
else echo "ERROR: Maven not found." >&2; exit 1; fi

echo "▸ Starting backend on :8080 …"
(cd "$DIR/backend" && "$MVN" -q spring-boot:run) &
BACK_PID=$!

if [ ! -d "$DIR/frontend/node_modules" ]; then
  (cd "$DIR/frontend" && npm install --no-audit --no-fund)
fi

echo "▸ Starting frontend on :5173 …"
(cd "$DIR/frontend" && npm run dev) &
FRONT_PID=$!

cleanup() {
  echo
  echo "▸ Stopping…"
  kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "──────────────────────────────────────────────"
echo "  Frontend (dev)  →  http://localhost:5173"
echo "  Backend  (api)  →  http://localhost:8080"
echo "  Press Ctrl+C to stop both."
echo "──────────────────────────────────────────────"

wait
