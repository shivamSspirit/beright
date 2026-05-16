#!/bin/bash
# Railway Entrypoint Script for BeRight Agents
# =============================================

echo "============================================"
echo "BeRight Railway Startup"
echo "============================================"

# Create directories (use /app if /data volume not mounted)
DATA_DIR="${BERIGHT_STATE_DIR:-/data}"
if [ ! -d "$DATA_DIR" ] || [ ! -w "$DATA_DIR" ]; then
  echo "Volume not mounted, using /app for storage"
  DATA_DIR="/app"
fi

mkdir -p "$DATA_DIR/state" "$DATA_DIR/memory" "$DATA_DIR/logs" "$DATA_DIR/.pm2" 2>/dev/null || true
mkdir -p /app/memory 2>/dev/null || true

export PM2_HOME="$DATA_DIR/.pm2"

echo "Environment:"
echo "  PORT: ${PORT:-8080}"
echo "  NODE_ENV: ${NODE_ENV:-production}"
echo "  PM2_HOME: $PM2_HOME"

echo ""
echo "Starting PM2 with ecosystem config..."
echo "============================================"

# pm2-runtime runs in foreground and handles signals
exec pm2-runtime start /app/ecosystem.railway.config.cjs
