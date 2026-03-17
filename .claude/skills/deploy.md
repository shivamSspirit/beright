# Skill: Deploy to Production

Systematic deployment workflow for Railway production environment.

## When to Use
- Deploying new features to production
- Hotfixes that need immediate deployment
- Scheduled releases

## Pre-Deployment Checklist

### 1. Code Quality
```bash
# Type check
npm run typecheck

# Build verification
npm run build

# Lint check
npm run lint
```

### 2. Git Status
```bash
# Ensure clean working tree
git status

# Ensure on main branch
git branch --show-current

# Ensure up to date with remote
git pull origin main
```

### 3. Environment Check
- Verify all required env vars are set in Railway
- Check for any new env vars that need adding
- Confirm secrets are not in code

## Deployment Steps

### Step 1: Final Verification
```bash
# One last build
npm run build
```

### Step 2: Deploy
```bash
# Deploy to Railway
railway up
```

### Step 3: Monitor
```bash
# Watch deployment logs
railway logs --follow
```

### Step 4: Verify
```bash
# Health check
curl https://beright-production.up.railway.app/api/health

# V2 health
curl https://beright-production.up.railway.app/api/v2/health
```

### Step 5: Smoke Test
- Check /api/v2/markets responds
- Verify Telegram bot responds to /start
- Test one agent query

## Rollback Procedure

If deployment fails or causes issues:

```bash
# View deployment history
railway deployments

# Rollback to previous
railway rollback
```

## Post-Deployment

1. Monitor logs for 5 minutes
2. Check error rates in monitoring
3. Notify team of successful deploy
4. Update CURRENT_TASK.md if applicable
