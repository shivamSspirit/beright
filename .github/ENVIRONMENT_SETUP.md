# GitHub Environment Setup for Railway Deployment

## Overview

The BeRight project uses GitHub Environments to manage deployment secrets and protection rules. The environment name is **`berightai`**.

## What You Need to Configure

### 1. GitHub Environment: `berightai`

Location: `Settings → Environments → berightai`

### 2. Environment Secrets (3 Required)

| Secret Name | Value | Where to Find |
|------------|-------|---------------|
| `RAILWAY_TOKEN` | `094009c0-10f4-4a52-833d-1497f39f7431` | Railway Dashboard → Account → Tokens |
| `RAILWAY_SERVICE_ID` | `b3c25a10-9c9b-44e3-bdc3-badad053302d` | From your Railway service URL |
| `RAILWAY_APP_URL` | `https://beright-api-production.up.railway.app` | Railway Dashboard → Deployments tab |

**Note:** `RAILWAY_PROJECT_ID` is no longer required with the new Docker container approach.

## Step-by-Step Setup

### Step 1: Navigate to Environments

1. Go to: https://github.com/shivamSspirit/beright
2. Click **Settings** (top navigation)
3. In left sidebar, click **Environments**
4. Click on **berightai** (or create it if missing)

### Step 2: Add All 3 Secrets

For each secret below, click **"Add secret"** in the Environment secrets section:

#### Secret 1: RAILWAY_TOKEN
```
Name: RAILWAY_TOKEN
Value: 094009c0-10f4-4a52-833d-1497f39f7431
```

#### Secret 2: RAILWAY_SERVICE_ID
```
Name: RAILWAY_SERVICE_ID
Value: b3c25a10-9c9b-44e3-bdc3-badad053302d
```

#### Secret 3: RAILWAY_APP_URL
```
Name: RAILWAY_APP_URL
Value: https://beright-api-production.up.railway.app
```

### Step 3: Verify Secrets are Added

In the **berightai** environment page, you should see all 3 secrets listed:

- ✅ RAILWAY_TOKEN
- ✅ RAILWAY_SERVICE_ID
- ✅ RAILWAY_APP_URL

## How It Works

### GitHub Actions Workflow

The `builder.yml` workflow has been updated to use the `berightai` environment:

```yaml
deploy:
  name: Deploy
  environment: berightai  # ← Uses this environment
  runs-on: ubuntu-latest
```

This means:
- ✅ The deploy job will use secrets from the `berightai` environment
- ✅ Environment protection rules apply (if configured)
- ✅ Deployment history is tracked per environment

### Deployment Process

When you push to `main`:

1. **Validate Job** - TypeScript checks, lint, build
2. **Deploy Job** - Uses `berightai` environment
   - Links to Railway project: `5acb9f49-1ae2-4ccb-94c6-8ce62f472cc4`
   - Deploys to service: `b3c25a10-9c9b-44e3-bdc3-badad053302d`
   - Verifies health at: `https://beright-api-production.up.railway.app`

## Testing the Setup

### 1. Trigger Deployment

```bash
git commit --allow-empty -m "test: verify Railway deployment with environment"
git push origin main
```

### 2. Monitor Deployment

Go to: [GitHub Actions](https://github.com/shivamSspirit/beright/actions)

You should see:
- ✅ **Validate** job passes
- ✅ **Deploy** job runs (uses `berightai` environment)
- ✅ Railway CLI links to project
- ✅ Deployment completes
- ✅ Health check succeeds

### 3. Verify Deployment

```bash
curl https://beright-api-production.up.railway.app/api/health
```

Expected response:
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

## Troubleshooting

### Error: "Environment berightai not found"

**Solution:** Create the environment:
1. Go to: Settings → Environments
2. Click **"New environment"**
3. Name: `berightai`
4. Click **"Configure environment"**
5. Add the 4 secrets

### Error: "RAILWAY_TOKEN not found"

**Solution:** Check you added secrets to the **environment**, not repository:
- ❌ Wrong: Settings → Secrets and variables → Actions → Repository secrets
- ✅ Correct: Settings → Environments → berightai → Environment secrets

### Error: "railway: command not found"

**Solution:** The workflow installs Railway CLI automatically. If error persists, check:
1. Node.js setup step runs successfully
2. `npm install -g @railway/cli` completes

### Error: "Could not link to Railway project"

**Solution:** Verify IDs are correct:
1. Check `RAILWAY_PROJECT_ID` matches your project URL
2. Check `RAILWAY_SERVICE_ID` matches your service URL
3. Ensure `RAILWAY_TOKEN` has permissions for the project

### Deployment succeeds but health check fails

**Solution:**
1. Wait 2-3 minutes for Railway to fully deploy
2. Check Railway logs for startup errors
3. Verify all required environment variables are set in Railway

## Environment Protection Rules (Optional)

You can add protection rules to the `berightai` environment:

### Wait Timer
- Add a delay before deployments start
- Useful for review windows

### Required Reviewers
- Require manual approval before deployment
- Select team members who must approve

### Deployment Branches
- Restrict which branches can deploy
- Currently: `main` only

To configure:
1. Go to: Settings → Environments → berightai
2. Scroll to **Deployment protection rules**
3. Configure as needed

## Security Best Practices

### ⚠️ Regenerate Railway Token

Since the token was exposed in chat:

1. Go to: [Railway Tokens](https://railway.app/account/tokens)
2. Find token: `094009c0-10f4-4a52-833d-1497f39f7431`
3. Click **"Revoke"** or **"Delete"**
4. Click **"Create New Token"**
5. Copy the new token
6. Update GitHub secret:
   - Settings → Environments → berightai
   - Edit `RAILWAY_TOKEN` secret
   - Paste new token

### Other Security Measures

- ✅ Never commit `.env` files
- ✅ Never share tokens in issues/chat
- ✅ Use GitHub Environments for deployment secrets
- ✅ Enable environment protection rules for production
- ✅ Rotate tokens regularly (every 90 days)
- ✅ Use Railway's built-in secrets for sensitive data

## Next Steps

After adding all secrets:

1. ✅ Push to main to trigger deployment
2. ✅ Monitor GitHub Actions for success
3. ✅ Verify health endpoint responds
4. ✅ Regenerate Railway token
5. ✅ Configure environment protection rules (optional)
6. ✅ Add additional Railway environment variables as needed

## Support

- **GitHub Environments Docs:** https://docs.github.com/en/actions/deployment/targeting-different-environments
- **Railway Docs:** https://docs.railway.app
- **BeRight Issues:** https://github.com/shivamSspirit/beright/issues

---

**Environment:** berightai
**Railway Project:** 5acb9f49-1ae2-4ccb-94c6-8ce62f472cc4
**Railway Service:** b3c25a10-9c9b-44e3-bdc3-badad053302d
**App URL:** https://beright-api-production.up.railway.app
