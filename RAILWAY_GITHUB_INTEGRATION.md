# Railway GitHub Integration Setup - Step by Step

This guide walks you through connecting your GitHub repository directly to Railway for automatic deployments. **No GitHub Actions needed!**

---

## 🎯 What You'll Get

- ✅ **Free automatic deployments** (no GitHub Actions minutes)
- ✅ **Deploy on every push** to main branch
- ✅ **No billing issues** (Railway native feature)
- ✅ **Faster deployments** (Railway optimized)
- ✅ **Built-in logs and monitoring**

**Time Required:** 5 minutes
**Cost:** $0 forever

---

## 📋 Step-by-Step Instructions

### Step 1: Open Your Railway Service

1. **Click this link:** [Open beright-api Service](https://railway.com/project/5acb9f49-1ae2-4ccb-94c6-8ce62f472cc4/service/b3c25a10-9c9b-44e3-bdc3-badad053302d)

2. You should see your **beright-api** service dashboard

**What you'll see:**
- Deployments tab
- Settings tab
- Logs tab
- Metrics tab

---

### Step 2: Go to Settings

1. Click the **"Settings"** tab (top navigation)
2. Scroll down to the **"Service Source"** section

**Current State:**
- You might see "Deploy from GitHub" or "No source connected"
- There should be a **"Connect Repo"** button

---

### Step 3: Connect Your GitHub Repository

1. Click **"Connect Repo"** (or "Change Source" if already connected)

2. **Authorize Railway** if prompted:
   - Railway will ask for GitHub permissions
   - Click **"Authorize Railway"**
   - This is safe - Railway is a trusted platform

3. **Select your repository:**
   - Find and click: **`shivamSspirit/beright`**

**✅ Repository connected!**

---

### Step 4: Configure Deployment Settings

After connecting the repo, you'll see deployment configuration options:

#### A. Branch Configuration

**Field:** "Branch"
**Value:** `main`

This tells Railway to deploy whenever you push to the `main` branch.

#### B. Root Directory (CRITICAL!)

**Field:** "Root Directory" or "Source Directory"
**Value:** `/beright-ts`

⚠️ **This is VERY important!** Your Railway service should deploy from the `beright-ts` folder, not the repository root.

**Why?** Your repo structure is:
```
beright/
├── beright-ts/        ← Railway deploys THIS
│   ├── package.json
│   ├── next.config.ts
│   └── ...
├── berightweb/
└── ...
```

#### C. Build Settings

Railway should auto-detect these, but verify:

**Build Command:** (leave default or blank)
- Railway will run `npm install && npm run build`

**Start Command:** (should be)
- `npm start`

**Install Command:** (should be)
- `npm install`

---

### Step 5: Configure Auto-Deploy

Look for deployment trigger settings:

1. **Find:** "Watch Paths" or "Deploy Triggers" section

2. **Enable:** "Deploy on push"
   - Toggle this ON
   - Should be enabled by default

3. **Branch filter:**
   - Ensure it says `main` or `**` (all branches)

**What this does:**
- Every time you `git push origin main`
- Railway automatically starts a new deployment
- No manual intervention needed

---

### Step 6: Configure Environment Variables

Click on **"Variables"** tab (top navigation)

**Verify these are set:**

| Variable Name | Value | Required |
|---------------|-------|----------|
| `PORT` | `8080` | ✅ Yes |
| `NODE_ENV` | `production` | ✅ Yes |
| `SUPABASE_URL` | Your Supabase URL | ✅ Yes |
| `SUPABASE_ANON_KEY` | Your Supabase key | ✅ Yes |
| `ANTHROPIC_API_KEY` | Your Anthropic key | ✅ Yes |
| `HELIUS_API_KEY` | Your Helius key | ✅ Yes |
| `RPC_URL` | Your Solana RPC URL | ✅ Yes |

**Optional but recommended:**
- `TELEGRAM_BOT_TOKEN` - For bot functionality
- `UPSTASH_REDIS_REST_URL` - For caching
- `TAVILY_API_KEY` - For web search

**How to add missing variables:**
1. Click **"New Variable"**
2. Enter **Variable Name**
3. Enter **Value**
4. Click **"Add"**

---

### Step 7: Save and Deploy

1. **Save your settings** (if there's a save button)

2. **Trigger first deployment:**
   - Railway might auto-deploy immediately
   - Or click **"Deploy"** button if available

3. **Watch the deployment:**
   - Go to **"Deployments"** tab
   - You should see a new deployment starting
   - Status will show: Building → Deploying → Active

---

### Step 8: Verify Deployment

#### Check Deployment Status

In the **Deployments** tab:
- ✅ Status should be **"Active"** (green)
- ✅ Should show recent timestamp
- ✅ Click deployment to see logs

#### Test Health Endpoint

```bash
curl https://beright-api-production.up.railway.app/api/health
```

**Expected response:**
```json
{
  "status": "degraded",
  "environment": "production",
  "features": {
    "supabase": true,
    "agents": true
  }
}
```

---

## 🧪 Test Automatic Deployment

Now test that auto-deploy works:

### Step 1: Make a Small Change

```bash
cd /Users/shivamsoni/Desktop/beright

# Create empty commit to trigger deployment
git commit --allow-empty -m "test: verify Railway auto-deploy"
git push origin main
```

### Step 2: Watch Railway

1. Go to [Railway Deployments](https://railway.com/project/5acb9f49-1ae2-4ccb-94c6-8ce62f472cc4/service/b3c25a10-9c9b-44e3-bdc3-badad053302d)

2. You should see:
   - New deployment appears automatically
   - Status: Building → Deploying → Active
   - Takes ~2-3 minutes

### Step 3: Verify

```bash
# Wait ~3 minutes, then test
curl https://beright-api-production.up.railway.app/api/health
```

**✅ If you see the health response, auto-deploy works!**

---

## 🎛️ Advanced Configuration (Optional)

### Deploy Previews for Pull Requests

Enable preview deployments for PRs:

1. Settings → **"Environments"**
2. Enable **"PR Deploys"**
3. Each PR gets its own preview URL

### Custom Domains

Add a custom domain:

1. Settings → **"Domains"**
2. Click **"Custom Domain"**
3. Add your domain (e.g., `api.beright.ai`)
4. Update DNS records as shown

### Deployment Notifications

Get notified on deployment events:

1. Settings → **"Integrations"**
2. Connect Slack, Discord, or webhooks
3. Get alerts on deployments, failures, etc.

---

## 🔧 Troubleshooting

### Deployment Fails

**Check:**
1. Deployment logs in Railway dashboard
2. Build command completed successfully
3. All environment variables are set
4. `beright-ts/package.json` exists

**Common fixes:**
- Verify root directory is `/beright-ts`
- Check `npm install` succeeds
- Ensure `npm start` command is valid

### Auto-Deploy Not Triggering

**Check:**
1. GitHub repo is connected in Settings
2. "Deploy on push" is enabled
3. Branch name matches (`main`)
4. Railway has GitHub permissions

**Fix:**
- Disconnect and reconnect repository
- Check Railway GitHub app permissions
- Verify webhook exists in GitHub repo settings

### Build Takes Too Long

**Normal build time:** 2-5 minutes

**If longer:**
- Check for dependency issues
- Review build logs for errors
- Consider optimizing `package.json`

---

## 📊 Deployment Comparison

| Feature | Railway GitHub Integration | GitHub Actions |
|---------|---------------------------|----------------|
| **Cost** | Free forever | Costs after 2000 min/month |
| **Speed** | ~2-3 minutes | ~8-10 minutes |
| **Setup** | 5 minutes (this guide) | 30+ minutes |
| **Maintenance** | None | Update workflows |
| **Billing Issues** | Never | Can be blocked |
| **Build Logs** | Railway dashboard | GitHub Actions tab |

**Winner:** Railway GitHub Integration ✅

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Railway service shows "Connected to GitHub"
- [ ] Repository: `shivamSspirit/beright`
- [ ] Branch: `main`
- [ ] Root Directory: `/beright-ts`
- [ ] All required environment variables set
- [ ] "Deploy on push" enabled
- [ ] Test deployment succeeded
- [ ] Health endpoint responds
- [ ] Auto-deploy works (tested with empty commit)

---

## 🎯 What Happens Now

### Every Time You Push to Main:

1. **You push code:**
   ```bash
   git push origin main
   ```

2. **Railway detects change** (via GitHub webhook)

3. **Automatic deployment starts:**
   - Clones repository
   - Navigates to `/beright-ts`
   - Runs `npm install`
   - Runs `npm run build`
   - Starts with `npm start`

4. **Deployment goes live:**
   - New version deployed
   - Zero downtime switch
   - Old version shut down

5. **You're notified:**
   - Check Railway dashboard
   - View deployment logs
   - Test health endpoint

**Time:** 2-3 minutes
**Cost:** $0
**Effort:** Zero (completely automatic!)

---

## 🚀 Next Steps After Setup

### 1. Remove GitHub Actions Workflow (Optional)

Since you're not using it anymore:

```bash
# Optional: Delete the workflow file
rm .github/workflows/builder.yml

# Or just disable it
git mv .github/workflows/builder.yml .github/workflows/builder.yml.disabled

git commit -m "chore: disable GitHub Actions (using Railway integration)"
git push origin main
```

### 2. Set Up Cron Jobs on Railway

For your heartbeat and other cron jobs:

**Option A: Use Railway Cron Jobs**
1. Settings → **"Cron"**
2. Add cron expressions
3. Example: `*/30 * * * *` (every 30 min)

**Option B: Use PM2 in Your App**
- Already configured in `ecosystem.railway.config.cjs`
- PM2 manages cron jobs internally

### 3. Monitor Your Deployments

Regularly check:
- Railway dashboard for deployment status
- Health endpoint for app status
- Logs for any errors

### 4. Regenerate Railway Token

⚠️ **Security reminder:**

The token `094009c0-10f4-4a52-833d-1497f39f7431` was exposed. Even though you're not using GitHub Actions anymore, regenerate it:

1. [Railway Tokens](https://railway.app/account/tokens)
2. Delete old token
3. Create new token
4. Update anywhere you use it (Railway CLI login, etc.)

---

## 📚 Useful Railway Commands

### View Logs
```bash
railway logs
railway logs -f  # Follow logs in real-time
```

### Check Status
```bash
railway status
```

### SSH into Container
```bash
railway run bash
```

### Deploy Manually (if needed)
```bash
cd beright-ts
railway up
```

---

## 🆘 Need Help?

### Railway Support
- Discord: [railway.gg/discord](https://discord.gg/railway)
- Help: [help.railway.app](https://help.railway.app)
- Docs: [docs.railway.com](https://docs.railway.com)

### Quick Links
- [Railway Dashboard](https://railway.com/project/5acb9f49-1ae2-4ccb-94c6-8ce62f472cc4)
- [Your Service](https://railway.com/project/5acb9f49-1ae2-4ccb-94c6-8ce62f472cc4/service/b3c25a10-9c9b-44e3-bdc3-badad053302d)
- [App URL](https://beright-api-production.up.railway.app)

---

## ✨ Summary

**What you accomplished:**
- ✅ Connected GitHub repo to Railway
- ✅ Configured automatic deployments
- ✅ Set up `/beright-ts` as root directory
- ✅ Tested auto-deploy works
- ✅ No more GitHub Actions billing issues!

**What happens automatically:**
- Every push to `main` → Railway deploys
- No manual intervention needed
- No costs (Railway native feature)
- Faster than GitHub Actions
- Better monitoring and logs

**Your app:**
- Live at: https://beright-api-production.up.railway.app
- Auto-deploys on every push
- Completely free CI/CD
- Professional deployment pipeline

---

🎉 **Congratulations!** You now have a professional, free, automatic deployment pipeline! 🚀
