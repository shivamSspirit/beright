# BeRight Security Runbook

Emergency procedures and configuration guides for BeRight Protocol security.

---

## Table of Contents

1. [JWT Configuration](#jwt-configuration)
2. [Secret Rotation](#secret-rotation)
3. [Kill Switch Operations](#kill-switch-operations)
4. [Incident Response](#incident-response)
5. [Database Security](#database-security)
6. [API Security](#api-security)
7. [Wallet Monitoring](#wallet-monitoring)
8. [Security Verification](#security-verification)
9. [Pre-Commit Hooks](#pre-commit-hooks)

---

## JWT Configuration

### Current Issue
Supabase default JWT expiration is set to extremely long durations (31+ years). This is a security risk.

### Recommended Configuration

| Setting | Current | Target |
|---------|---------|--------|
| JWT Expiration | 31 years | 7 days |
| Refresh Token | None | 30 days |

### Steps to Update JWT Expiration

1. **Login to Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your BeRight project

2. **Navigate to Auth Settings**
   - Click "Authentication" in the left sidebar
   - Click "Settings" tab

3. **Update JWT Expiry**
   - Find "JWT expiry time" setting
   - Change from default to: `604800` (7 days in seconds)
   - Click "Save"

4. **Configure Refresh Tokens** (if using web app)
   - Enable "Use Refresh Token Rotation"
   - Set refresh token lifetime: `2592000` (30 days)

5. **Update Client Code**
   After changing JWT expiration, ensure your client handles token refresh:

   ```typescript
   // In your Supabase client setup
   const supabase = createClient(url, anonKey, {
     auth: {
       autoRefreshToken: true,
       persistSession: true,
       detectSessionInUrl: true,
     },
   });
   ```

6. **Verify**
   - Sign out and sign back in
   - Check that sessions work correctly
   - Monitor for any auth errors in logs

### Impact Assessment
- Existing sessions will expire based on old settings
- No immediate action required for existing users
- New sessions will use 7-day expiration

---

## Secret Rotation

### Priority Order
Rotate secrets in this order to minimize downtime:

1. **Railway** (backend) - Update first
2. **Vercel** (frontend) - Update second
3. **Local .env** - Update last (dev only)

### Rotation Procedures

#### Anthropic API Key
```bash
# 1. Generate new key at console.anthropic.com
# 2. Update Railway
railway variables --set ANTHROPIC_API_KEY=new_key

# 3. Update Vercel
vercel env add ANTHROPIC_API_KEY production

# 4. Revoke old key at Anthropic console
```

#### Supabase Service Role Key
```bash
# WARNING: This will invalidate all backend operations

# 1. Go to Supabase Dashboard > Settings > API
# 2. Click "Regenerate" next to service_role key
# 3. IMMEDIATELY update Railway
railway variables --set SUPABASE_SERVICE_ROLE_KEY=new_key

# 4. Redeploy
railway up
```

#### Solana Private Key
```bash
# CRITICAL: Transfer funds BEFORE rotating

# 1. Generate new keypair
solana-keygen new -o new-keypair.json

# 2. Get new public key
solana-keygen pubkey new-keypair.json

# 3. Transfer all funds from old wallet to new wallet
solana transfer <NEW_PUBKEY> ALL --from <OLD_KEYPAIR>

# 4. Update the key as JSON array
cat new-keypair.json | jq -c '.'

# 5. Update Railway
railway variables --set SOLANA_PRIVATE_KEY='[...]'

# 6. Securely delete old keypair
shred -u new-keypair.json
```

#### Telegram Bot Token
```bash
# 1. Go to @BotFather in Telegram
# 2. Send /revoke to get a new token
# 3. Update Railway
railway variables --set TELEGRAM_BOT_TOKEN=new_token

# 4. Restart bot service
```

### Rotation Schedule
| Secret Type | Rotation Frequency |
|-------------|-------------------|
| API Keys | Quarterly |
| Database Credentials | Semi-annually |
| Solana Keys | Only if compromised |
| JWT Secret | Annually |

---

## Kill Switch Operations

### Available Kill Switches

| Switch | Environment Variable | Default |
|--------|---------------------|---------|
| Trading | `TRADING_ENABLED` | true |
| Withdrawals | `WALLET_WITHDRAWALS` | true |
| Public API | `API_PUBLIC_ACCESS` | true |
| Telegram Bot | `TELEGRAM_BOT_ENABLED` | true |
| Auto-Trading | `AUTO_TRADING_ENABLED` | false |
| New Signups | `NEW_SIGNUPS_ENABLED` | true |

### Emergency Shutdown

#### Disable All Trading (Code Red)
```bash
# Railway
railway variables --set TRADING_ENABLED=false
railway variables --set AUTO_TRADING_ENABLED=false
railway variables --set WALLET_WITHDRAWALS=false
railway up
```

#### Disable Public Access
```bash
railway variables --set API_PUBLIC_ACCESS=false
railway up
```

#### Disable Telegram Bot
```bash
railway variables --set TELEGRAM_BOT_ENABLED=false
railway up
```

### Re-enabling Features
```bash
# Verify the issue is resolved first
railway variables --set TRADING_ENABLED=true
railway up

# Monitor logs for 15 minutes
railway logs --follow
```

---

## Incident Response

### Wallet Compromise

**Severity: CRITICAL**

1. **Immediate Actions** (< 5 minutes)
   ```bash
   # Disable all trading and withdrawals
   railway variables --set TRADING_ENABLED=false
   railway variables --set WALLET_WITHDRAWALS=false
   railway up
   ```

2. **Transfer Remaining Funds** (< 15 minutes)
   ```bash
   # Generate emergency wallet
   solana-keygen new -o emergency.json

   # Transfer all SOL
   solana transfer $(solana-keygen pubkey emergency.json) ALL

   # Transfer all tokens (repeat for each)
   spl-token transfer <MINT> ALL <EMERGENCY_PUBKEY>
   ```

3. **Rotate Credentials** (< 30 minutes)
   - Generate new Solana keypair
   - Update all deployments
   - Revoke old access

4. **Post-Incident**
   - Audit transaction history
   - Notify affected users
   - Document incident

### Database Breach

**Severity: CRITICAL**

1. **Immediate Actions**
   ```bash
   # Disable API access
   railway variables --set API_PUBLIC_ACCESS=false
   railway up
   ```

2. **Revoke Supabase Keys**
   - Go to Supabase Dashboard > Settings > API
   - Click "Regenerate" for both anon and service_role keys

3. **Update All Services**
   ```bash
   railway variables --set SUPABASE_ANON_KEY=new_key
   railway variables --set SUPABASE_SERVICE_ROLE_KEY=new_key
   railway up
   ```

4. **Audit**
   - Check `security_events` table for suspicious activity
   - Review RLS policy logs
   - Check for unauthorized data access

### API Key Leak

**Severity: HIGH**

1. **Identify Leaked Key Type**
2. **Revoke at Source** (Anthropic, Groq, etc.)
3. **Generate New Key**
4. **Update Deployments**
5. **Check for Unauthorized Usage**

---

## Database Security

### RLS Verification

Run this query to verify all tables have RLS enabled:

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All tables should show `t` (true) for `rls_enabled`.

### Security Events Monitoring

```sql
-- Recent security events (last 24 hours)
SELECT * FROM get_recent_security_events(24);

-- Security stats
SELECT * FROM get_security_stats(24);

-- Failed auth attempts
SELECT * FROM security_events
WHERE event_type = 'auth_failure'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Injection attempts
SELECT * FROM security_events
WHERE event_type = 'injection_attempt'
ORDER BY created_at DESC
LIMIT 50;
```

### Transaction Audit

```sql
-- Recent transactions
SELECT * FROM transaction_audits
ORDER BY created_at DESC
LIMIT 50;

-- Failed transactions
SELECT * FROM transaction_audits
WHERE status = 'failed'
ORDER BY created_at DESC;

-- High-value transactions
SELECT * FROM transaction_audits
WHERE amount_lamports > 1000000000 -- > 1 SOL
ORDER BY created_at DESC;
```

### Cleanup

Security events older than 90 days are automatically cleaned up. To run manually:

```sql
SELECT cleanup_old_security_events(90);
```

---

## Contacts

| Role | Contact |
|------|---------|
| Security Lead | @shivamsoni |
| DevOps | Railway Dashboard |
| Database | Supabase Dashboard |

---

---

## API Security

### Authentication Methods

The API supports multiple authentication methods:

| Method | Header | Example |
|--------|--------|---------|
| Bearer Token | `Authorization: Bearer <token>` | Privy JWT |
| API Key | `X-API-Key: <key>` | Programmatic access |
| Wallet | `X-Wallet-Address: <address>` | Solana wallet |
| Service | `X-Service-Key: <key>` | Internal services |

### Rate Limits

| Tier | Requests/min | Requests/hr |
|------|-------------|-------------|
| Public | 10 | 100 |
| Verified | 30 | 500 |
| Admin | 100 | 2000 |
| Service | 1000 | 10000 |

### Security Dashboard

```bash
# View security overview (admin only)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.beright.ai/api/v2/security

# Include recent events
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://api.beright.ai/api/v2/security?events=true&hours=24"

# Query security events
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://api.beright.ai/api/v2/security/events?severity=warning"
```

### Protected Endpoints

These endpoints require authentication:

- `POST /api/v2/execution` - Trade execution (verified+)
- `GET /api/v2/security/*` - Security dashboard (admin only)
- `POST /api/v2/pools/*/stake` - Staking (verified+)

---

## Wallet Monitoring

### Configuration

Set these environment variables to enable protocol wallet monitoring:

```bash
PROTOCOL_WALLET_ADDRESS=<main_wallet>
FEE_WALLET_ADDRESS=<fee_collection_wallet>
TREASURY_WALLET_ADDRESS=<treasury_wallet>
```

### Alert Thresholds

| Alert Type | Default Threshold |
|------------|------------------|
| Low Balance | < 0.5 SOL |
| Large Outflow | > 5 SOL |
| Hourly Outflow | > 50 SOL/hr |
| High Value Tx | > 10 SOL or > $1000 |

### Manual Wallet Check

```typescript
import { getWalletStatus } from '@/lib/solana';

const status = await getWalletStatus('wallet_address');
console.log(status);
// { balanceSol, isLow, recentOutflowSol, alertsTriggered }
```

### Start Monitoring at Startup

```typescript
import { startProtocolWalletMonitoring } from '@/lib/solana';

// In your app initialization
startProtocolWalletMonitoring();
```

---

## Security Verification

### Run Verification Script

```bash
cd beright-ts
npx ts-node scripts/verify-security.ts
```

This checks:
- Required environment variables
- RLS policies on all tables
- Security tables exist
- Kill switch status
- Security files present

### Manual Checks

```bash
# 1. Check pre-commit hooks
pre-commit run --all-files

# 2. Scan for secrets
gitleaks detect --source .

# 3. Verify RLS
npx supabase db execute "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'"

# 4. Check health endpoint
curl https://api.beright.ai/api/health | jq '.security'
```

---

## Pre-Commit Hooks

### Installation

```bash
# Install hooks (one-time setup)
./scripts/install-hooks.sh

# Or manually
pip install pre-commit detect-secrets
brew install gitleaks  # macOS
pre-commit install
```

### What Gets Checked

1. **detect-secrets** - Scans for API keys, passwords, tokens
2. **gitleaks** - Custom patterns for BeRight secrets

### Bypass (Emergency Only)

```bash
# Skip hooks for emergency commits (NOT recommended)
git commit --no-verify -m "Emergency fix"
```

### Update Baseline

When adding legitimate secrets to tests:

```bash
# Re-scan and update baseline
detect-secrets scan > .secrets.baseline
git add .secrets.baseline
```

---

## Appendix: Quick Commands

```bash
# Check kill switch status
curl https://api.beright.ai/api/health | jq '.security.killSwitches'

# View security logs (Railway)
railway logs --grep "SECURITY"

# Check RLS status
npx supabase db execute "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'"

# Run security verification
npx ts-node scripts/verify-security.ts

# Test pre-commit hooks
pre-commit run --all-files

# Send test alert
curl -X POST https://api.beright.ai/api/v2/security/test-alert \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Security Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Pre-Commit  │  │ CI Scanning │  │ Runtime Protection  │ │
│  │   Hooks     │  │  (GitHub)   │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│        │                │                    │              │
│        ▼                ▼                    ▼              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              API Gateway (Next.js)                  │   │
│  │  • Auth Middleware   • Rate Limiting                │   │
│  │  • Input Validation  • Output Filtering             │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│        ┌─────────────────┼─────────────────┐               │
│        ▼                 ▼                 ▼               │
│  ┌───────────┐    ┌───────────┐    ┌───────────────┐      │
│  │  Supabase │    │  Solana   │    │   Telegram    │      │
│  │   (RLS)   │    │  (Audit)  │    │   (Filtered)  │      │
│  └───────────┘    └───────────┘    └───────────────┘      │
│        │                 │                 │               │
│        ▼                 ▼                 ▼               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Security Events & Alerts                  │   │
│  │  • security_events table  • Telegram alerts         │   │
│  │  • transaction_audits     • Console logging         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `lib/security/init.ts` | Security initialization |
| `lib/middleware/auth.ts` | API authentication |
| `lib/middleware/securityLogger.ts` | Event logging |
| `lib/validation/index.ts` | Input validation (Zod) |
| `lib/killSwitch.ts` | Emergency kill switches |
| `lib/solana/auditLog.ts` | Transaction auditing |
| `lib/solana/monitor.ts` | Wallet monitoring |
| `lib/monitoring/alerts.ts` | Telegram/console alerts |
| `supabase/migrations/20260404_*.sql` | RLS policies & tables |
| `scripts/verify-security.ts` | Security verification |
