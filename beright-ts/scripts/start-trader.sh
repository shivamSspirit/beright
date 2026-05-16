#!/bin/bash
#
# Start Autonomous Paper Trader
#
# Usage:
#   ./scripts/start-trader.sh          # Run in foreground
#   ./scripts/start-trader.sh daemon   # Run as PM2 daemon
#   ./scripts/start-trader.sh stop     # Stop PM2 daemon
#   ./scripts/start-trader.sh logs     # View logs
#   ./scripts/start-trader.sh status   # Check status
#

cd "$(dirname "$0")/.."

# Create logs directory
mkdir -p logs

case "$1" in
  daemon)
    echo "Starting Autonomous Trader as daemon..."
    pm2 start ecosystem.config.js --only autonomous-trader
    pm2 save
    echo ""
    echo "Trader started! Monitor with: pm2 monit"
    echo "View logs with: pm2 logs autonomous-trader"
    ;;

  stop)
    echo "Stopping Autonomous Trader..."
    pm2 stop autonomous-trader
    ;;

  restart)
    echo "Restarting Autonomous Trader..."
    pm2 restart autonomous-trader
    ;;

  logs)
    pm2 logs autonomous-trader --lines 100
    ;;

  status)
    pm2 status autonomous-trader
    ;;

  *)
    echo "═══════════════════════════════════════════════════════════"
    echo "  BeRight Autonomous Paper Trader"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Starting in foreground mode (Ctrl+C to stop)..."
    echo ""
    npx ts-node services/autonomousTrader.ts
    ;;
esac
