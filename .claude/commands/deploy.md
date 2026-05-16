# /deploy

Deploy the application to Railway production.

## Pre-flight Checks

1. Verify git status is clean:
   ```bash
   git status --short
   ```

2. Run typecheck:
   ```bash
   npm run typecheck
   ```

3. Run build:
   ```bash
   npm run build
   ```

4. Confirm on main branch:
   ```bash
   git branch --show-current
   ```

## Deployment

If all checks pass:
```bash
railway up
```

## Post-deployment

1. Wait for deployment to complete
2. Check health endpoint:
   ```bash
   curl https://beright-production.up.railway.app/api/health
   ```

3. Verify critical APIs respond

## Output Format

```
Deployment Pipeline
───────────────────
[✓] Git status clean
[✓] TypeCheck passed
[✓] Build succeeded
[✓] On main branch
[→] Deploying to Railway...
[✓] Deployment complete
[✓] Health check passed

Production URL: https://beright-production.up.railway.app
```
