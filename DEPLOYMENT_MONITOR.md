# Railway Deployment Monitoring Guide

## 🚀 Deployment Triggered!

**Commit:** `d9fc5cf`
**Timestamp:** March 26, 2026
**Status:** Deployment in progress...

---

## 📊 Monitor Deployment

### 1. GitHub Actions (Primary)

👉 **Watch here:** [GitHub Actions - Latest Run](https://github.com/shivamSspirit/beright/actions)

**Expected Steps:**

```
✅ Validate Job
   ├─ Checkout code
   ├─ Setup Node.js 20
   ├─ Install dependencies
   ├─ TypeCheck beright-ts
   ├─ TypeCheck berightweb
   ├─ Lint backend
   ├─ Build backend
   └─ Build frontend

✅ Deploy to Railway Job (uses berightai environment)
   ├─ Checkout code
   ├─ Deploy beright-ts Service
   │  ├─ Start Railway CLI container
   │  ├─ Deploy with --ci flag
   │  └─ Service ID: b3c25a10-9c9b-44e3-bdc3-badad053302d
   ├─ Wait for Deployment (30s)
   └─ Verify Railway Health (5 retries, 10s each)
      ├─ Attempt 1/5...
      ├─ Attempt 2/5...
      └─ ✅ Health check passed!
```

**Timeline:**
- Validate: ~5-8 minutes (builds both projects)
- Deploy: ~2-3 minutes (Railway deployment)
- **Total: ~7-11 minutes**

### 2. Railway Dashboard

👉 **Check here:** [Railway Deployments](https://railway.com/project/5acb9f49-1ae2-4ccb-94c6-8ce62f472cc4/service/b3c25a10-9c9b-44e3-bdc3-badad053302d)

**What to look for:**
- 🟢 **Status:** "Active" (deployment succeeded)
- 🔵 **Status:** "Building" (deployment in progress)
- 🔴 **Status:** "Failed" (check logs)

### 3. Health Endpoint

Test the deployed app directly:

```bash
# Quick test
curl https://beright-api-production.up.railway.app/api/health

# Pretty print
curl -s https://beright-api-production.up.railway.app/api/health | jq
```

**Expected Response:**
```json
{
  "status": "degraded",
  "version": "1.0.0",
  "environment": "production",
  "timestamp": "2026-03-26T...",
  "features": {
    "onchain": false,
    "kalshi": false,
    "telegram": false,
    "supabase": true,
    "agents": true,
    "rateLimit": false
  },
  "checks": {
    "supabase": {
      "status": "ok",
      "latency": 1307
    },
    "redis": {
      "status": "degraded",
      "error": "Not configured"
    },
    "solana": {
      "status": "ok",
      "latency": 39
    }
  }
}
```

---

## ✅ Success Indicators

### GitHub Actions
- ✅ All validate checks pass (TypeScript, lint, build)
- ✅ Deploy job completes without errors
- ✅ Health check returns HTTP 200

### Railway Dashboard
- ✅ Deployment shows "Active" status
- ✅ New deployment appears with recent timestamp
- ✅ Logs show "Server listening on port 8080"

### Health Endpoint
- ✅ Returns JSON response (not 404 or 500)
- ✅ `status` field present
- ✅ `environment` shows "production"
- ✅ `features.supabase` is `true`
- ✅ `features.agents` is `true`

---

## 🔴 Failure Scenarios

### Scenario 1: Validate Job Fails

**Symptoms:**
- TypeScript errors
- Lint errors
- Build failures

**Solution:**
- Fix the reported errors locally
- Test with `npm run build` in both projects
- Commit fixes and push again

### Scenario 2: Deploy Job Fails

**Symptoms:**
- "railway: command not found"
- "Authentication failed"
- "Service not found"

**Solution:**
1. Check secrets in [berightai environment](https://github.com/shivamSspirit/beright/settings/environments/13454478033/edit)
2. Verify all 3 required secrets exist:
   - RAILWAY_TOKEN
   - RAILWAY_SERVICE_ID
   - RAILWAY_APP_URL
3. Check Railway token hasn't expired

### Scenario 3: Health Check Fails

**Symptoms:**
- All retries fail (5 attempts)
- HTTP 404 or 500 errors
- Connection timeout

**Solution:**
1. Wait 2-3 minutes (Railway may still be deploying)
2. Check Railway logs for startup errors
3. Verify environment variables in Railway dashboard
4. Ensure PORT=8080 is set in Railway

---

## 📋 Post-Deployment Checklist

After deployment succeeds:

### Immediate (Required)
- [ ] ✅ Verify GitHub Actions shows all green
- [ ] ✅ Verify Railway dashboard shows "Active"
- [ ] ✅ Test health endpoint responds
- [ ] ⚠️ **REGENERATE RAILWAY TOKEN** (exposed in chat)

### Health Check
- [ ] Test API endpoint: `curl https://beright-api-production.up.railway.app/api/health`
- [ ] Verify Supabase connection (check logs)
- [ ] Verify Solana RPC connection (check logs)

### Optional Features (If Configured)
- [ ] Test Telegram bot (if `TELEGRAM_BOT_TOKEN` set)
- [ ] Check Redis connection (if `UPSTASH_REDIS_REST_URL` set)
- [ ] Verify on-chain features (if `SOLANA_PRIVATE_KEY` set)

### Security (Critical)
- [ ] Go to [Railway Tokens](https://railway.app/account/tokens)
- [ ] Delete token: `094009c0-10f4-4a52-833d-1497f39f7431`
- [ ] Create new token
- [ ] Update `RAILWAY_TOKEN` in berightai environment
- [ ] Test deployment still works with new token

---

## 🔧 Debugging Commands

### View Railway Logs
```bash
# Install Railway CLI locally (if not installed)
npm install -g @railway/cli

# Login
railway login

# View logs
railway logs --service b3c25a10-9c9b-44e3-bdc3-badad053302d

# Follow logs in real-time
railway logs --service b3c25a10-9c9b-44e3-bdc3-badad053302d -f
```

### Check PM2 Status (if using)
```bash
# SSH into Railway
railway run bash

# Check PM2 processes
pm2 status

# View logs
pm2 logs
```

### Test Locally
```bash
# Test the build process locally
cd beright-ts
npm install
npm run build
npm start

# In another terminal, test health
curl http://localhost:3001/api/health
```

---

## 📈 Performance Metrics

Expected performance after deployment:

| Metric | Target | Acceptable | Action If Below |
|--------|--------|------------|-----------------|
| **Build Time** | <7 min | <10 min | Optimize dependencies |
| **Deploy Time** | <3 min | <5 min | Check Railway status |
| **Health Response** | <500ms | <2s | Check DB connection |
| **API Latency** | <100ms | <500ms | Add caching |

---

## 🎯 Next Steps After Success

### 1. Verify Cron Jobs Work

The heartbeat cron should run every 30 minutes. Check in 30 minutes:

```bash
# Check Railway logs for heartbeat activity
railway logs --service b3c25a10-9c9b-44e3-bdc3-badad053302d | grep heartbeat
```

### 2. Enable Optional Features

**Telegram Bot:**
```bash
# Add to Railway environment variables
TELEGRAM_BOT_TOKEN=your_token
```

**Redis Caching:**
```bash
# Add to Railway environment variables
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

### 3. Monitor for Issues

- Watch Railway dashboard for crashes
- Check GitHub Actions for failed cron jobs
- Monitor health endpoint every hour
- Review logs for errors

### 4. Set Up Alerts

Configure Railway to send alerts on:
- Deployment failures
- High memory usage
- Crashes or restarts
- Health check failures

---

## 📞 Support

If deployment fails or you need help:

1. **Share this information:**
   - GitHub Actions run URL
   - Railway deployment logs
   - Error messages from health endpoint
   - Screenshot of Railway dashboard

2. **Check documentation:**
   - `.github/DEPLOYMENT_FIX.md` - Root cause analysis
   - `.github/ENVIRONMENT_SETUP.md` - Environment configuration
   - `.github/RAILWAY_SETUP.md` - Railway setup guide

3. **Common issues:**
   - [Railway Help Station](https://station.railway.com/)
   - [Railway Documentation](https://docs.railway.com/)
   - [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

**Monitoring Status:** 🟢 Active
**Last Updated:** March 26, 2026
**Next Check:** Monitor GitHub Actions at https://github.com/shivamSspirit/beright/actions
