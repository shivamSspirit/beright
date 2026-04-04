# BeRight Security Checklist

Quick verification checklist for security configurations. Run before deployments.

---

## Pre-Deployment Checklist

### Environment Variables

- [ ] `SUPABASE_URL` configured
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configured (Railway/Vercel only)
- [ ] `SUPABASE_ANON_KEY` configured
- [ ] `ANTHROPIC_API_KEY` configured
- [ ] `HELIUS_RPC_MAINNET` configured (not public RPC)
- [ ] `UPSTASH_REDIS_REST_URL` configured
- [ ] `UPSTASH_REDIS_REST_TOKEN` configured
- [ ] `TELEGRAM_BOT_TOKEN` configured
- [ ] `SUPER_ADMIN_TELEGRAM_ID` configured
- [ ] No production secrets in local `.env` files

### Database Security

- [ ] All tables have RLS enabled
- [ ] `security_events` table exists
- [ ] `transaction_audits` table exists
- [ ] JWT expiration set to 7 days (not 31 years)
- [ ] Refresh token rotation enabled

### API Security

- [ ] Auth middleware applied to protected routes
- [ ] Rate limiting configured per tier
- [ ] Input validation (Zod) on all POST endpoints
- [ ] Output filtering enabled

### Git Security

- [ ] Pre-commit hooks installed (`./scripts/install-hooks.sh`)
- [ ] `.secrets.baseline` up to date
- [ ] GitHub security scanning enabled
- [ ] No secrets in commit history

### Solana Security

- [ ] Private key stored as env var only
- [ ] Transaction audit logging enabled
- [ ] Wallet monitoring started (production)
- [ ] JITO MEV protection enabled

### Kill Switches

- [ ] `TRADING_ENABLED` = true (or intentionally disabled)
- [ ] `WALLET_WITHDRAWALS` = true (or intentionally disabled)
- [ ] `API_PUBLIC_ACCESS` = true (or intentionally disabled)
- [ ] `AUTO_TRADING_ENABLED` = false (default)

---

## Quick Verification Commands

```bash
# Run security verification script
cd beright-ts && npx ts-node scripts/verify-security.ts

# Check pre-commit hooks
pre-commit run --all-files

# Scan for secrets
gitleaks detect --source .

# Check RLS status
npx supabase db execute "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'"

# Check health endpoint
curl https://api.beright.ai/api/health | jq '.security'

# View kill switch status
curl https://api.beright.ai/api/health | jq '.security.killSwitches'
```

---

## Post-Deployment Verification

- [ ] `/api/health` returns `status: healthy`
- [ ] `/api/health` shows `security.initialized: true`
- [ ] Security logs appearing in `security_events` table
- [ ] Telegram alerts working (test with `/api/v2/security/test-alert`)
- [ ] Protected endpoints require authentication
- [ ] Rate limiting active (test by hitting limits)

---

## Incident Response Quick Actions

### Disable Trading Immediately
```bash
railway variables --set TRADING_ENABLED=false && railway up
```

### Disable All Public Access
```bash
railway variables --set API_PUBLIC_ACCESS=false && railway up
```

### Emergency Wallet Transfer
```bash
solana transfer <SAFE_WALLET> ALL --from <COMPROMISED_KEYPAIR>
```

### Regenerate Supabase Keys
1. Go to Supabase Dashboard > Settings > API
2. Click "Regenerate" next to service_role key
3. Update Railway: `railway variables --set SUPABASE_SERVICE_ROLE_KEY=new_key`
4. Redeploy: `railway up`

---

## Rotation Schedule

| Secret | Frequency | Last Rotated |
|--------|-----------|--------------|
| Anthropic API Key | Quarterly | ___________ |
| Supabase Keys | Semi-annually | ___________ |
| Telegram Bot Token | As needed | ___________ |
| Solana Keys | Only if compromised | ___________ |
| JWT Secret | Annually | ___________ |

---

## Security Contacts

| Role | Contact |
|------|---------|
| Security Lead | @shivamsoni |
| Escalation | Telegram SUPER_ADMIN |
| Database Admin | Supabase Dashboard |
| Infrastructure | Railway Dashboard |

---

## Files Reference

| File | Purpose |
|------|---------|
| `docs/SECURITY_RUNBOOK.md` | Full security procedures |
| `scripts/verify-security.ts` | Automated verification |
| `lib/security/init.ts` | Security initialization |
| `lib/killSwitch.ts` | Emergency kill switches |
| `lib/middleware/auth.ts` | API authentication |
| `lib/middleware/securityLogger.ts` | Event logging |
| `.pre-commit-config.yaml` | Git hooks config |
| `.gitleaks.toml` | Secret patterns |
