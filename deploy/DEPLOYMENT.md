# BeRight Deployment Guide

Deploy BeRight with **Vercel** (frontend) + **AWS EC2** (backend + agents).

## Architecture

```
┌──────────────────┐         ┌─────────────────────────────┐
│     Vercel       │         │        AWS EC2              │
│   berightweb     │───API──▶│      beright-ts             │
│   (Frontend)     │         │  + Telegram Bot             │
│   Port 3000      │         │  + Heartbeat Agent          │
│                  │         │  + Builder Agent            │
└──────────────────┘         └─────────────────────────────┘
        ▲                              ▲
        │                              │
   beright.xyz                  api.beright.xyz
```

---

## Part 1: Deploy Backend on AWS EC2

### Step 1: Create EC2 Instance

1. Go to [AWS EC2 Console](https://console.aws.amazon.com/ec2)
2. Click **Launch Instance**
3. Configure:
   - **Name**: `beright-api`
   - **AMI**: Ubuntu Server 24.04 LTS
   - **Instance type**: `t3.small` (2 vCPU, 2GB RAM) - ~$15/mo
   - **Key pair**: Create new or use existing
   - **Network**: Allow SSH (22), HTTP (80), HTTPS (443)
   - **Storage**: 20GB gp3

4. Click **Launch Instance**

### Step 2: Connect to EC2

```bash
# Download your .pem key and connect
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

### Step 3: Run Setup Script

```bash
# Clone repo
cd /opt
sudo git clone https://github.com/shivamSspirit/beright.git
sudo chown -R ubuntu:ubuntu beright
cd beright

# Run setup script
chmod +x deploy/setup-ec2.sh
sudo ./deploy/setup-ec2.sh
```

### Step 4: Configure Application

```bash
# Install dependencies
npm install
cd beright-ts && npm install && cd ..

# Create .env file
cp .env.example .env
nano .env  # Fill in all your API keys
```

**Required Environment Variables:**
```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Solana/Helius
HELIUS_API_KEY=xxx
SOLANA_PRIVATE_KEY=[0,0,0...]
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx

# Telegram
TELEGRAM_BOT_TOKEN=xxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional but recommended
TAVILY_API_KEY=tvly-xxx
DFLOW_API_KEY=xxx
```

### Step 5: Build and Test

```bash
cd beright-ts
npm run build

# Test the API starts
npm start
# Press Ctrl+C after confirming it works
```

### Step 6: Setup Nginx + SSL

```bash
# Point your domain to EC2's public IP first (Route 53 or your DNS)
# Example: api.beright.xyz -> 54.xx.xx.xx

# Configure Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/beright
sudo nano /etc/nginx/sites-available/beright
# Replace api.beright.xyz with YOUR domain

# Enable site
sudo ln -s /etc/nginx/sites-available/beright /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com
```

### Step 7: Start Services with PM2

```bash
cd /opt/beright

# Create logs directory
mkdir -p logs

# Start all services
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs

# Save PM2 config (survives reboot)
pm2 save

# Setup auto-start on boot
pm2 startup
# Copy and run the command it outputs
```

### Step 8: Verify Backend

```bash
# Test API
curl https://api.yourdomain.com/api/health

# Check PM2 services
pm2 status

# Should show:
# beright-api     │ online
# telegram-bot    │ online
# heartbeat       │ online
```

---

## Part 2: Deploy Frontend on Vercel

### Step 1: Push to GitHub

```bash
# Make sure your repo is pushed to GitHub
git add .
git commit -m "Add deployment configuration"
git push origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Add New Project**
3. Import `shivamSspirit/beright`
4. Configure:
   - **Root Directory**: `berightweb`
   - **Framework**: Next.js (auto-detected)

### Step 3: Add Environment Variables

In Vercel project settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_PRIVY_APP_ID=xxx
NEXT_PUBLIC_SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=xxx
```

### Step 4: Deploy

Click **Deploy** - Vercel will build and deploy automatically.

### Step 5: Configure Custom Domain (Optional)

1. In Vercel → Project → Settings → Domains
2. Add `beright.xyz` or your domain
3. Update DNS to point to Vercel

---

## PM2 Commands Reference

```bash
# View all services
pm2 status

# View logs
pm2 logs              # All logs
pm2 logs beright-api  # Specific service

# Restart services
pm2 restart all
pm2 restart beright-api

# Stop/Start specific service
pm2 stop telegram-bot
pm2 start telegram-bot

# Reload with zero downtime
pm2 reload all

# Monitor resources
pm2 monit
```

---

## Updating the Application

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@<EC2-IP>

# Pull latest code
cd /opt/beright
git pull origin main

# Install new dependencies (if any)
npm install
cd beright-ts && npm install && npm run build && cd ..

# Restart services
pm2 restart all
```

Vercel auto-deploys on push to `main` branch.

---

## Costs

| Service | Monthly Cost |
|---------|-------------|
| Vercel (Frontend) | Free |
| AWS EC2 t3.small | ~$15 |
| Route 53 (DNS) | ~$0.50 |
| **Total** | **~$16/mo** |

For lower cost, use `t3.micro` (~$8/mo) but with 1GB RAM.

---

## Troubleshooting

### API not responding
```bash
pm2 logs beright-api --lines 100
pm2 restart beright-api
```

### Telegram bot not working
```bash
pm2 logs telegram-bot --lines 100
# Check TELEGRAM_BOT_TOKEN in .env
```

### SSL certificate issues
```bash
sudo certbot renew --dry-run
sudo systemctl restart nginx
```

### Out of memory
```bash
# Check memory
free -h

# Upgrade to larger instance or reduce services
pm2 stop builder  # Builder uses most memory
```
