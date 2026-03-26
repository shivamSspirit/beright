# Railway Deployment Setup for GitHub Actions

This guide will help you configure GitHub Actions to automatically deploy BeRight to Railway.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Railway Project**: Create a new project for beright-ts
3. **GitHub Repository**: Fork or have write access to the BeRight repository

## Step 1: Get Railway Token

1. Go to [Railway Dashboard](https://railway.app)
2. Click on your profile → Account Settings
3. Navigate to "Tokens" section
4. Click "Create New Token"
5. Copy the token (starts with `RAILWAY_`)

## Step 2: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

### Required Secrets

| Secret Name | Description | Example |
|------------|-------------|---------|
| `RAILWAY_TOKEN` | Railway API token | `RAILWAY_abc123...` |
| `RAILWAY_APP_URL` | Your Railway app URL | `https://beright-production.up.railway.app` |

### Optional Secrets (for additional features)

| Secret Name | Description |
|------------|-------------|
| `VERCEL_TOKEN` | For frontend deployment |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

## Step 3: Configure Railway Environment Variables

In your Railway project, add these environment variables:

### Required Variables

```bash
# Server
PORT=8080
NODE_ENV=production

# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# AI/LLM
ANTHROPIC_API_KEY=sk-ant-xxx

# Blockchain
HELIUS_API_KEY=your_helius_key
HELIUS_RPC_MAINNET=https://mainnet.helius-rpc.com/?api-key=xxx
RPC_URL=https://api.mainnet-beta.solana.com

# Bot
TELEGRAM_BOT_TOKEN=your_telegram_token
```

### Recommended Variables

```bash
# Search & Data
TAVILY_API_KEY=tvly-xxx
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Trading (if enabled)
SOLANA_PRIVATE_KEY=[0,0,0,...]
KALSHI_API_KEY=xxx
JITO_BLOCK_ENGINE_URL=xxx
DFLOW_API_KEY=xxx
```

## Step 4: Link Railway CLI (Local Development)

If you want to deploy from local machine:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
cd beright-ts
railway link

# Deploy manually
railway up
```

## Step 5: Verify Deployment

After pushing to main branch:

1. Go to GitHub Actions tab
2. Check the "BeRight Builder CI/CD" workflow
3. Verify the "Deploy" job completes successfully
4. Check Railway dashboard for deployment status
5. Test the health endpoint:

```bash
curl https://your-app.railway.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-26T...",
  "services": {
    "api": "running",
    "telegram": "running",
    "heartbeat": "running"
  }
}
```

## Step 6: Configure Cron Jobs

Railway will automatically handle cron jobs using PM2 from `ecosystem.railway.config.cjs`.

The following services will run:

| Service | Schedule | Description |
|---------|----------|-------------|
| api | Always on | Next.js API server |
| telegram | Always on | Telegram bot handler |
| heartbeat | Every 30min | Autonomous cognitive loop |

## Step 7: Monitor Deployment

### View Logs

```bash
# Via Railway CLI
railway logs

# Via Railway Dashboard
# → Select your project → Deployments → Click latest → View logs
```

### Check Service Status

```bash
# SSH into Railway container
railway run bash

# Check PM2 status
pm2 status

# View specific service logs
pm2 logs api
pm2 logs telegram
pm2 logs heartbeat
```

## Troubleshooting

### Deployment Fails with "RAILWAY_TOKEN not found"

- Verify you added `RAILWAY_TOKEN` to GitHub Secrets
- Check the token hasn't expired in Railway dashboard

### Health Check Fails

- Verify `RAILWAY_APP_URL` is correct in GitHub Secrets
- Check Railway logs for startup errors
- Ensure PORT=8080 is set in Railway environment variables

### Cron Jobs Not Running

- Check PM2 logs: `railway run pm2 logs heartbeat`
- Verify ecosystem.railway.config.cjs is present
- Ensure Railway plan supports background workers

### Out of Memory

1. Upgrade Railway plan to Pro (1GB+ RAM)
2. Or disable non-essential services in ecosystem config

## Cost Estimation

| Plan | Resources | Monthly Cost |
|------|-----------|--------------|
| Hobby | 512MB RAM, Shared CPU | $5 |
| Pro | 1GB+ RAM, Dedicated CPU | $10-20 |

**Recommendation**: Pro plan with 1GB RAM for production use.

## Security Best Practices

1. ✅ Never commit `.env` files or secrets
2. ✅ Use GitHub Secrets for sensitive tokens
3. ✅ Rotate API keys regularly
4. ✅ Use Railway's built-in secrets management
5. ✅ Enable Railway's automatic HTTPS
6. ✅ Set `NODE_ENV=production` in Railway

## Support

- Railway Docs: https://docs.railway.app
- GitHub Issues: https://github.com/shivamSspirit/beright/issues
- Railway Discord: https://discord.gg/railway
