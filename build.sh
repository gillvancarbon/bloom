#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Bloom · Habit Tracker — build everything into one JAR
#  Usage:  ./build.sh
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
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

# ── Locate Node / npm ────────────────────────────────────────
if ! command -v npm >/dev/null 2>&1; then
  if [ -x /tmp/opencode/node/bin/npm ]; then
    export PATH="/tmp/opencode/node/bin:$PATH"
  else
    echo "ERROR: Node.js / npm not found. Install Node 18+." >&2
    exit 1
  fi
fi

# ── Locate Maven (wrapper preferred) ─────────────────────────
if [ -x "$DIR/backend/mvnw" ]; then
  MVN="$DIR/backend/mvnw"
elif command -v mvn >/dev/null 2>&1; then
  MVN="mvn"
elif [ -x /tmp/opencode/maven/bin/mvn ]; then
  MVN=/tmp/opencode/maven/bin/mvn
else
  echo "ERROR: Maven not found (and no mvnw wrapper)." >&2
  exit 1
fi

echo "▸ Building frontend…"
cd "$DIR/frontend"
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
fi
npm run build

echo "▸ Building backend (bundling frontend)…"
cd "$DIR/backend"
"$MVN" -q -DskipTests package

JAR="$(ls -1 "$DIR/backend/target/"*.jar | grep -v '\.original$' | head -n 1)"
echo "✓ Build complete → $JAR"
