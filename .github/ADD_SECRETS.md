# Adding GitHub Secrets - Step by Step

## Step 1: Go to Environment Settings

1. Open your repository: https://github.com/shivamSspirit/beright
2. Click **"Settings"** tab (top right)
3. In the left sidebar, click **"Environments"**
4. Click on **"berightai"** environment (or create it if it doesn't exist)

## Step 2: Add RAILWAY_TOKEN

1. Scroll down to **"Environment secrets"**
2. Click **"Add secret"**
3. Name: `RAILWAY_TOKEN`
4. Value: `094009c0-10f4-4a52-833d-1497f39f7431`
5. Click **"Add secret"**

## Step 3: Add RAILWAY_PROJECT_ID

1. Click **"Add secret"** again
2. Name: `RAILWAY_PROJECT_ID`
3. Value: `5acb9f49-1ae2-4ccb-94c6-8ce62f472cc4`
4. Click **"Add secret"**

## Step 4: Add RAILWAY_SERVICE_ID

1. Click **"Add secret"** again
2. Name: `RAILWAY_SERVICE_ID`
3. Value: `b3c25a10-9c9b-44e3-bdc3-badad053302d`
4. Click **"Add secret"**

## Step 5: Add RAILWAY_APP_URL

1. Click **"Add secret"** again
2. Name: `RAILWAY_APP_URL`
3. Value: `https://beright-api-production.up.railway.app`
4. Click **"Add secret"**

## Step 4: IMPORTANT - Regenerate Railway Token

⚠️ **Security Alert**: Since you shared the token in chat, regenerate it immediately:

1. Go to [Railway Dashboard → Account Settings → Tokens](https://railway.app/account/tokens)
2. Find your token (named "default" or custom name)
3. Click **"Revoke"** or **"Delete"**
4. Click **"Create New Token"**
5. Copy the new token
6. Go back to GitHub Secrets
7. Edit `RAILWAY_TOKEN` secret with the new token

## Step 5: Verify Secrets are Added

In GitHub Actions secrets page, you should see:

- ✅ `RAILWAY_TOKEN` (hidden)
- ✅ `RAILWAY_APP_URL` (hidden)

## Step 6: Test Deployment

Trigger a deployment:

```bash
# Option 1: Push any change to main
git commit --allow-empty -m "test: trigger Railway deployment"
git push origin main

# Option 2: Use GitHub Actions UI
# Go to: Actions → BeRight Builder CI/CD → Run workflow
```

## Step 7: Monitor Deployment

1. Go to **Actions** tab in GitHub
2. Click on the running workflow
3. Watch the **"Deploy"** job
4. Should see: ✅ Backend deployed successfully

## Step 8: Verify Deployment

Once deployed, test the health endpoint:

```bash
curl https://your-app.railway.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-26T...",
  "services": {
    "api": "running"
  }
}
```

## Troubleshooting

### Error: "RAILWAY_TOKEN not found"
- Double-check you added `RAILWAY_TOKEN` to GitHub Secrets (not variables)
- Secret name must be exactly `RAILWAY_TOKEN` (case-sensitive)

### Error: "railway: command not found"
- This is expected in GitHub Actions - it will install Railway CLI automatically
- If running locally, install: `npm install -g @railway/cli`

### Deployment succeeds but app doesn't start
- Check Railway logs: Go to Railway dashboard → Deployments → Click latest → View logs
- Verify environment variables are set in Railway dashboard
- Ensure `PORT=8080` is set in Railway

### Health check fails
- Wait 2-3 minutes for Railway to fully deploy
- Verify `RAILWAY_APP_URL` is correct (no trailing slash)
- Check Railway logs for startup errors

## Next Steps

After deployment succeeds:

1. ✅ Verify health endpoint responds
2. ✅ Check Railway logs for any errors
3. ✅ Test Telegram bot functionality
4. ✅ Monitor cron jobs in Railway dashboard

## Security Checklist

- [ ] Railway token added to GitHub Secrets
- [ ] Railway token regenerated after sharing in chat
- [ ] Old token revoked in Railway dashboard
- [ ] GitHub Secrets are private (not visible in logs)
- [ ] Environment variables use Railway's secrets (not committed to code)
