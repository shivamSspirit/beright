#!/bin/bash
#
# EC2 Deployment Script for BeRight Autonomous Trader
#
# This script deploys and runs the autonomous trader 24/7 on EC2.
#
# First-time setup on EC2:
#   1. SSH into your EC2 instance
#   2. Clone the repo: git clone <your-repo> beright
#   3. cd beright/beright-ts
#   4. Run: ./scripts/deploy-ec2.sh setup
#
# After that, just push to git and run:
#   ./scripts/deploy-ec2.sh
#
# Commands:
#   ./scripts/deploy-ec2.sh          # Pull latest + restart trader
#   ./scripts/deploy-ec2.sh setup    # First-time setup
#   ./scripts/deploy-ec2.sh start    # Start trader
#   ./scripts/deploy-ec2.sh stop     # Stop trader
#   ./scripts/deploy-ec2.sh logs     # View logs
#   ./scripts/deploy-ec2.sh status   # Check status
#

set -e

cd "$(dirname "$0")/.."
PROJECT_DIR=$(pwd)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[Deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[Warning]${NC} $1"; }
error() { echo -e "${RED}[Error]${NC} $1"; exit 1; }

# Check if PM2 is installed
check_pm2() {
  if ! command -v pm2 &> /dev/null; then
    error "PM2 not installed. Run: npm install -g pm2"
  fi
}

# First-time setup
setup() {
  log "Running first-time EC2 setup..."

  # Check Node.js
  if ! command -v node &> /dev/null; then
    error "Node.js not installed. Install with: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  fi

  log "Node version: $(node -v)"

  # Install PM2 globally
  log "Installing PM2..."
  npm install -g pm2

  # Install dependencies
  log "Installing project dependencies..."
  npm install

  # Create logs directory
  mkdir -p logs

  # Set up PM2 to start on boot
  log "Setting up PM2 startup..."
  pm2 startup
  echo ""
  warn "Run the command above with sudo if prompted!"
  echo ""

  # Check for .env
  if [ ! -f .env ]; then
    warn ".env file not found!"
    echo "Create it with: cp .env.example .env && nano .env"
    echo "Required vars: KALSHI_API_KEY, KALSHI_PRIVATE_KEY, KALSHI_USE_DEMO=true"
  else
    log ".env file found"
  fi

  log "Setup complete! Run './scripts/deploy-ec2.sh start' to start the trader."
}

# Deploy (pull + restart)
deploy() {
  log "Deploying latest changes..."

  # Pull latest
  log "Pulling from git..."
  git pull origin main

  # Install any new dependencies
  log "Installing dependencies..."
  npm install

  # Restart ALL processes (trader + telegram bot)
  log "Restarting all processes..."
  pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js

  # Save PM2 state
  pm2 save

  log "Deployment complete!"
  pm2 status
}

# Start trader
start() {
  check_pm2
  log "Starting Autonomous Trader..."

  mkdir -p logs
  pm2 start ecosystem.config.js --only autonomous-trader
  pm2 save

  log "Trader started!"
  echo ""
  echo "Monitor: pm2 monit"
  echo "Logs:    pm2 logs autonomous-trader"
  echo "Status:  pm2 status"
}

# Stop trader
stop() {
  check_pm2
  log "Stopping Autonomous Trader..."
  pm2 stop autonomous-trader
  pm2 save
  log "Trader stopped"
}

# View logs
logs() {
  check_pm2
  pm2 logs autonomous-trader --lines 200
}

# Check status
status() {
  check_pm2
  echo ""
  pm2 status
  echo ""
  pm2 describe autonomous-trader 2>/dev/null || warn "Trader not running"
}

# Main
case "$1" in
  setup)
    setup
    ;;
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    check_pm2
    log "Restarting..."
    pm2 restart autonomous-trader
    pm2 save
    ;;
  logs)
    logs
    ;;
  status)
    status
    ;;
  *)
    deploy
    ;;
esac
