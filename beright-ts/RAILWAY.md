# BeRight Railway Deployment Guide

Deploy BeRight agents on Railway with PM2 process management.

## Quick Deploy

### 1. One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/YOUR_USERNAME/beright&envs=TELEGRAM_BOT_TOKEN,SUPABASE_URL,SUPABASE_ANON_KEY,MISTRAL_API_KEY)

Or manually:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project (in beright-ts directory)
cd beright-ts
railway init

# Add volume for persistent storage
railway volume add --mount-path /data

# Deploy
railway up
```

### 2. Configure Environment Variables

In Railway dashboard → Variables, add:

**Required:**
```
PORT=8080
NODE_ENV=production
TELEGRAM_BOT_TOKEN=your_telegram_token
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

**Recommended:**
```
MISTRAL_API_KEY=your_mistral_key
GROQ_API_KEY=your_groq_key
TAVILY_API_KEY=your_tavily_key
```

**For Trading (optional):**
```
SOLANA_PRIVATE_KEY=[0,0,0,...]
HELIUS_API_KEY=your_helius_key
HELIUS_RPC_MAINNET=https://mainnet.helius-rpc.com/?api-key=xxx
```

### 3. Verify Deployment

```bash
# Check health endpoint
curl https://your-app.railway.app/api/health

# View logs
railway logs
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Railway Service                     │
│  ┌─────────────────────────────────────────────────┐│
│  │                    PM2                          ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐││
│  │  │ Next.js  │ │ Telegram │ │   Heartbeat      │││
│  │  │ API:8080 │ │   Bot    │ │   (30min loop)   │││
│  │  └──────────┘ └──────────┘ └──────────────────┘││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  ┌─────────────────────────────────────────────────┐│
│  │          /data Volume (persistent)               ││
│  │   ├── memory/          (agent memory)            ││
│  │   ├── state/           (application state)       ││
│  │   ├── logs/            (PM2 logs)                ││
│  │   └── .pm2/            (PM2 config)              ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Services Running:**
| Service | Description | Memory |
|---------|-------------|--------|
| api | Next.js API server on port 8080 | ~512MB |
| telegram | Telegram bot handler | ~256MB |
| heartbeat | Cognitive loop (30 min) | ~256MB |

---

## Enable Optional Services

Edit `ecosystem.railway.config.cjs` to uncomment additional services:

- **scanner** - Market opportunity detection
- **autopredict** - Continuous forecasting
- **trader** - Autonomous trading (requires SOLANA_PRIVATE_KEY)

---

## Commands

```bash
# Deploy changes
railway up

# View logs
railway logs

# SSH into container
railway run bash

# Check PM2 status (inside container)
railway run pm2 status

# View specific service logs
railway run pm2 logs api
railway run pm2 logs telegram

# Restart services
railway run pm2 restart all
```

---

## Costs

| Plan | RAM | CPU | Price |
|------|-----|-----|-------|
| Hobby | 512MB | Shared | $5/mo |
| Pro | 1GB+ | Dedicated | ~$10-20/mo |

Recommended: **Pro plan** with 1GB RAM for all 3 core services.

---

## Troubleshooting

### API not responding
```bash
railway run pm2 logs api --lines 100
```

### Telegram bot not receiving messages
```bash
railway run pm2 logs telegram --lines 100
# Check TELEGRAM_BOT_TOKEN is set correctly
```

### Out of memory
1. Upgrade to Pro plan
2. Or reduce services in ecosystem.railway.config.cjs

### Volume not persisting
Ensure volume is mounted at `/data` in Railway dashboard.

---

## Local Development

For local dev, use the original scripts:
```bash
npm run dev:full  # API + Telegram bot
```

Or with PM2:
```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs
```
