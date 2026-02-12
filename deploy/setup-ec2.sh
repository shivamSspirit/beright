#!/bin/bash
# BeRight AWS EC2 Setup Script
# Run this on a fresh Ubuntu 22.04/24.04 EC2 instance
#
# Usage:
#   chmod +x setup-ec2.sh
#   ./setup-ec2.sh

set -e

echo "=========================================="
echo "BeRight EC2 Setup Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run with sudo: sudo ./setup-ec2.sh${NC}"
    exit 1
fi

echo -e "${GREEN}[1/8] Updating system packages...${NC}"
apt update && apt upgrade -y

echo -e "${GREEN}[2/8] Installing dependencies...${NC}"
apt install -y curl git nginx certbot python3-certbot-nginx ufw

echo -e "${GREEN}[3/8] Installing Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo -e "${GREEN}[4/8] Installing PM2...${NC}"
npm install -g pm2

echo -e "${GREEN}[5/8] Installing ts-node...${NC}"
npm install -g ts-node typescript

echo -e "${GREEN}[6/8] Configuring firewall...${NC}"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo -e "${GREEN}[7/8] Creating app directory...${NC}"
mkdir -p /opt/beright
mkdir -p /opt/beright/logs
chown -R ubuntu:ubuntu /opt/beright

echo -e "${GREEN}[8/8] Setup complete!${NC}"
echo ""
echo "=========================================="
echo -e "${YELLOW}Next Steps:${NC}"
echo "=========================================="
echo ""
echo "1. Clone your repository:"
echo "   cd /opt/beright"
echo "   git clone https://github.com/shivamSspirit/beright.git ."
echo ""
echo "2. Install dependencies:"
echo "   npm install"
echo "   cd beright-ts && npm install && cd .."
echo ""
echo "3. Create .env file:"
echo "   cp .env.example .env"
echo "   nano .env  # Fill in all your API keys"
echo ""
echo "4. Build the project:"
echo "   cd beright-ts && npm run build && cd .."
echo ""
echo "5. Setup Nginx (replace YOUR_DOMAIN):"
echo "   cp deploy/nginx.conf /etc/nginx/sites-available/beright"
echo "   sed -i 's/api.beright.xyz/YOUR_DOMAIN/g' /etc/nginx/sites-available/beright"
echo "   ln -s /etc/nginx/sites-available/beright /etc/nginx/sites-enabled/"
echo "   nginx -t && systemctl reload nginx"
echo ""
echo "6. Get SSL certificate:"
echo "   certbot --nginx -d YOUR_DOMAIN"
echo ""
echo "7. Start services with PM2:"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup  # Auto-start on reboot"
echo ""
echo "8. Monitor services:"
echo "   pm2 status"
echo "   pm2 logs"
echo ""
echo -e "${GREEN}Setup script completed successfully!${NC}"
