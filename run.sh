#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Bloom · Habit Tracker
#  Builds (if needed) and serves the whole app on one port.
#  Usage:  ./run.sh            → http://localhost:8080
#          PORT=9090 ./run.sh  → custom port
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
if [ -z "$JAVA_HOME" ]; then
  echo "ERROR: Java 21+ not found. Install a JDK or set JAVA_HOME." >&2
  exit 1
fi
JAVA="$JAVA_HOME/bin/java"

JAR="$(ls -1 "$DIR/backend/target/"*.jar 2>/dev/null | grep -v '\.original$' | head -n 1 || true)"
if [ -z "$JAR" ] || [ ! -f "$JAR" ]; then
  echo "▸ No build yet — running build.sh first…"
  "$DIR/build.sh"
  JAR="$(ls -1 "$DIR/backend/target/"*.jar | grep -v '\.original$' | head -n 1)"
fi

cd "$DIR/backend"
echo "──────────────────────────────────────────────"
echo "  Bloom is blooming at  http://localhost:${PORT:-8080}"
echo "  Press Ctrl+C to stop."
echo "──────────────────────────────────────────────"
exec "$JAVA" ${PORT:+-Dserver.port=$PORT} -jar "$JAR"
