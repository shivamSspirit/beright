#!/bin/bash
# BeRight local dev launcher
# Runs both beright-ts (port 3001) and berightweb (port 3000) together.
# Usage: ./dev.sh
# Stop: Ctrl+C

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Kill any stale processes on the dev ports
cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$API_PID" "$WEB_PID" 2>/dev/null
  rm -f "$ROOT/berightweb/.next/dev/lock"
  exit 0
}
trap cleanup SIGINT SIGTERM

# Remove stale lock
rm -f "$ROOT/berightweb/.next/dev/lock"

echo "Starting beright-ts on :3001..."
cd "$ROOT/beright-ts" && npm run dev &
API_PID=$!

echo "Waiting for beright-ts to be ready..."
for i in $(seq 1 20); do
  if curl -s --max-time 1 http://localhost:3001/api/ping >/dev/null 2>&1; then
    echo "beright-ts ready"
    break
  fi
  sleep 1
done

echo "Starting berightweb on :3000..."
cd "$ROOT/berightweb" && npm run dev &
WEB_PID=$!

echo ""
echo "Both servers running:"
echo "  API:  http://localhost:3001"
echo "  Web:  http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both."

wait
