# BeRight Protocol - Production Checklist

## Pre-Launch Verification

### PHASE 0: Security (BLOCKER)

- [ ] **Rotate all secrets** - Every key in .env must be regenerated
  - [ ] Solana private key (generate new wallet)
  - [ ] Helius API key
  - [ ] Telegram bot token
  - [ ] Anthropic API key
  - [ ] Kalshi API credentials
  - [ ] Supabase keys
  - [ ] Upstash Redis credentials

- [ ] **Configure secrets in hosting platform**
  - [ ] Vercel environment variables (berightweb)
  - [ ] Railway/Render environment variables (beright-ts)
  - [ ] Never store secrets in git

- [ ] **Verify .gitignore**
  ```bash
  git status  # Should NOT show .env, *.pem, keypair.json
  ```

- [ ] **Run startup validation**
  ```bash
  npx ts-node lib/startup.ts
  ```

### PHASE 1: Rate Limiting

- [ ] **Upstash Redis configured**
  - [ ] UPSTASH_REDIS_REST_URL set
  - [ ] UPSTASH_REDIS_REST_TOKEN set

- [ ] **Test rate limiting**
  ```bash
  # Hit endpoint 100+ times, verify 429 response
  for i in {1..120}; do curl -s http://localhost:3001/api/markets | head -c 50; echo; done
  ```

### PHASE 2: Observability

- [ ] **Structured logs visible**
  ```bash
  npm run dev  # Check for JSON-formatted logs
  ```

- [ ] **Log aggregation configured** (optional but recommended)
  - [ ] Datadog / Logtail / Papertrail integration
  - [ ] Error alerting (Sentry)

### PHASE 3: API Endpoints

- [ ] **All endpoints responding**
  ```bash
  # Health check
  curl http://localhost:3001/api/health

  # Markets
  curl http://localhost:3001/api/markets?hot=true

  # Arbitrage
  curl http://localhost:3001/api/arbitrage

  # Research
  curl -X POST http://localhost:3001/api/research \
    -H "Content-Type: application/json" \
    -d '{"question": "Will Bitcoin reach 100K?"}'

  # Whale
  curl http://localhost:3001/api/whale

  # Intel
  curl http://localhost:3001/api/intel?q=crypto

  # Portfolio (with auth)
  curl http://localhost:3001/api/portfolio?userId=test
  ```

- [ ] **Response times acceptable**
  - Markets: < 500ms
  - Arbitrage: < 2000ms
  - Research: < 5000ms (AI-intensive)

### PHASE 4: Real-time Stream

- [ ] **SSE stream working**
  ```bash
  curl -N http://localhost:3001/api/stream
  # Should see: event: connected
  ```

- [ ] **Heartbeat received every 30s**

### PHASE 5: berightweb Integration

- [ ] **API_URL configured in berightweb**
- [ ] **CORS working** (if different domains)
- [ ] **Auth flow working**
  - [ ] Supabase auth
  - [ ] Wallet connect
  - [ ] Telegram link

- [ ] **UI states handled**
  - [ ] Loading states
  - [ ] Error states
  - [ ] Empty states
  - [ ] Rate limit messages

### PHASE 6: Database

- [ ] **Supabase tables exist**
  ```sql
  -- Verify tables
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public';
  ```

- [ ] **Row Level Security enabled**
  ```sql
  -- Check RLS
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public';
  ```

- [ ] **Indexes created for common queries**

---

## Deployment Commands

### beright-ts (Backend)

```bash
# Install dependencies
npm install

# Build
npm run build

# Start production
npm run start

# Or with PM2
pm2 start npm --name "beright-ts" -- start
```

### berightweb (Frontend)

```bash
# Install dependencies
npm install

# Build
npm run build

# Start production
npm run start

# Or deploy to Vercel
vercel --prod
```

---

## Monitoring Endpoints

| Endpoint | Purpose | Expected |
|----------|---------|----------|
| `/api/health` | System health | `{"status": "healthy"}` |
| `/api/stream` | Real-time events | SSE connection |

---

## Rollback Plan

1. **Revert deployment**
   ```bash
   vercel rollback  # For Vercel
   # Or redeploy previous git commit
   ```

2. **Rotate compromised secrets immediately**

3. **Check logs for error patterns**
   ```bash
   tail -f /var/log/beright.log | jq
   ```

---

## Post-Launch Monitoring

- [ ] Error rate < 1%
- [ ] P95 latency < 500ms
- [ ] Memory usage stable
- [ ] No secret leaks in logs
- [ ] Rate limiting effective

---

## Contacts

- **On-call**: @shivamSspirit
- **Repository**: https://github.com/your-org/beright-ts
- **Dashboard**: (add monitoring URL)
